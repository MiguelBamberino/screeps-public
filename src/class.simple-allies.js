

// This isn't in the docs for some reason, so we need to add it
const maxSegmentsOpen = 10;
const DEFAULT_NUKE_BARRAGE_INTERVAL = 500; // avg. time for a room to re-spawn core room creeps
const DEFAULT_NUKE_BARRAGE_START_TICK = 1; // fire asap
const DEFAULT_NUKE_BARRAGE_MAX_NUKES = 999;// no end to the barrage

//
const EFunnelGoalType = {
    GCL: 0,
    RCL7: 1,
    RCL8: 2
};

/**
 * This class is designed as an evolution of the original simple-allies code, found here:
 * https://github.com/screepers/simpleAllies/blob/main/src/js/simpleAllies.js
 *
 * I've added:
 * - local stashing of all ally data, so that you can access Ally requests when you can't see their segment
 * - CPU improvements, by on storing raw string data and parsing JSON on demand.
 * - added requestBarrage(), working with SneakyPolarBear & Kalgen
 * - added player synced nuke launches, using requestBarrage() + getOpenBarrageJobs()
 * - Added read wrappers for making it easier for player bots to access/filter what they want to read
 * - added log support, for player bots to hook their logger in. Instead of console.log()
 * - Error handling method changed to screeps style ERR_* and log LEVEL=ERROR, so player bots are not crashed from miss-use
 */
class SimpleAllies {

    /**
     *
     * @param array allies - list of player usernames
     * @param number segID - the segment that you all share
     * @param string myUsername - your username
     * @param bool writeMyRequestsEveryTick -> If true, your segment is updated every tick.
     *                                          Only set to true, if you update your requests every tick
     */
    constructor(allies,segID,myUsername,writeMyRequestsEveryTick=false) {
        this.allies = allies;

        this._PlayerNameInAllyList = this.allies.includes(myUsername);

        this.myUsername = myUsername;
        this._parsed = false;
        this._writeMyRequestsEveryTick = writeMyRequestsEveryTick;
        // This is the conventional segment used for team communication
        this.allySegmentID=segID;

        this.rawSegmentData={};
        this.allyRequests={};
        this.myRequests = {};
        this.nukeSleeps={};

        // get us set up, during the global reset
        RawMemory.setPublicSegments([segID]);

    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Utility  methods - Handling segment data
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Allow you to inject your own bots logger
     * Pass in a logger function that follows fn(level, category, message, subject)
     * This function will receive log messages from this class
     * level=INFO|WARNING|ERROR|VERBOSE
     * @param fn
     */
    setLogger(fn){
        this.logger=fn;
    }
    _log(level,category,msg,subject){
        if(this.logger)this.logger(level,category,msg,subject);
    }
    /**
     * To call before any requests are made or responded to. Must be called every tick.
     * Carries out memory & cache management. ~0.009 CPU/tick
     */
    initRun() {

        // to save CPU, we won't write out to the segment, unless forced
        this._updateMySegment = this._writeMyRequestsEveryTick;
        // If we're doing refresh every tick, Reset the HEAP data of myRequests, ready for the bot to add new requests this tick
        if(this._updateMySegment)this.myRequests = {};

        return this._readAllySegment();
    }
    /**
     * To call after requests have been made, to assign requests to the next ally
     */
    endRun() {
        if(!this._updateMySegment)return;
        // Make sure we don't have too many segments open
        if (Object.keys(RawMemory.segments).length >= maxSegmentsOpen) {
            throw Error('Too many segments open: simpleAllies');
        }
        RawMemory.segments[this.allySegmentID] = JSON.stringify({requests: this.myRequests});

    }

    _parseRawData(){

        if(this._parsed )return;
        for(let username in this.rawSegmentData){
            let data = this.rawSegmentData[username];
            if(data){
                try{
                    if(!this.allyRequests[username] || !this.allyRequests[username]._parsedAt || this.allyRequests[username]._parsedAt < this.rawSegmentData[username].updatedAt )
                    // Protect from errors as we try to get ally segment data
                    this.allyRequests[username] = JSON.parse(data);
                    this.allyRequests[username]._parsedAt = Game.time;
                }catch (e) {
                    this._log("ERROR", "simple-allies", "Error reading segment for Ally:"+username, 'parse-data')
                }
            }else if(this.allyRequests[username]){
                // this ally had data, then wiped their segment
                this.allyRequests[username] = { requests: {},parsedAt:Game.time};
            }
        }
        this._parsed = true;
    }
    /**
     * Read current foreignSegment & move pointer for next read
     */
    _readAllySegment() {
        if (!this.allies.length) {
            // this feels like an ERROR, because it can't proceed. Players should probably toggle simple-allies off, when not in an alliance
            this._log('ERROR',"simple-allies","No Allies set","read-segment")
            return ERR_NOT_FOUND;
        }
        if(this._PlayerNameInAllyList){
            // we don't want to break the players bot from them making a config mistake, but this class can't run
            this._log('ERROR',"simple-allies","Remove your Username from the Ally list","read-segment")
            return ERR_INVALID_ARGS;
        }

        if(this.currentAlly===undefined){
            this.currentAlly=0;
            this._log('VERBOSE',"simple-allies","First tick after global reset. Requesting first Ally:"+this.allies[this.currentAlly],"read-segment")
            RawMemory.setActiveForeignSegment(this.allies[this.currentAlly], this.allySegmentID);
            return ERR_TIRED;
        }

        let currentAllyUsername = this.allies[this.currentAlly];

        this.currentAlly++;
        if(this.currentAlly===this.allies.length)this.currentAlly=0;
        this._log('VERBOSE',"simple-allies","Set next Ally to read:"+this.allies[this.currentAlly],"read-segment")

        // Make a request to read the data of the next ally, for next tick, regardless if the current read fails
        RawMemory.setActiveForeignSegment(this.allies[this.currentAlly], this.allySegmentID);


        if (!RawMemory.foreignSegment){
            // Maybe the code didn't run last tick, so we didn't set a new read segment
            this._log('VERBOSE',"simple-allies","No foreignSegment for "+currentAllyUsername,"read-segment")
            return ERR_NOT_FOUND;
        }

        if (RawMemory.foreignSegment.username !== currentAllyUsername){
            // something big went wrong. We've got out of sync.
            this._log('ERROR',"simple-allies","foreignSegment.username="+RawMemory.foreignSegment.username+" != currentAlly:"+currentAllyUsername,"read-segment")
            return ERR_NOT_FOUND;
        }
        // just load in ally's string data. We'll JSON.parse it later, when we're ready
        if(!this.rawSegmentData[currentAllyUsername] || this.rawSegmentData[currentAllyUsername].data!==RawMemory.foreignSegment.data){
            this.rawSegmentData[currentAllyUsername] = { updatedAt:Game.time, data:RawMemory.foreignSegment.data};
            this._parsed = false;// reset the global parse check, so we know to review all ally data.
        }
        return OK;

    }


    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Read Request methods - Reading requests from Allies
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Get an array, containing all Users' Funnel requests. requests[i].username
    getFunnelRequests() {return this._getRequestsByType('funnel');}
    getResourceRequests() {return this._getRequestsByType('resource');}
    getAttackRequests() {return this._getRequestsByType('attack');}
    getBarrageRequests() {return this._getRequestsByType('barrage');}

    // get the full object data, posted by all users. Keyed by user
    // data is raw, and has no clean-up of bad data
    getAllRequests(){
        this._parseRawData();
        return this.allyRequests;
    }
    // get the full object data, posted by a given user
    // data is raw, and has no clean-up of bad data
    getRequestsByUser(username){
        this._parseRawData();
        if(!this.allyRequests[username])return undefined;
        return this.allyRequests[username].requests;
    }

    // internal function, not intended for public use
    _getRequestsByType(type){
        this._parseRawData();
        let requests = [];
        for(let username in this.allyRequests){
            if(typeof this.allyRequests[username].requests!=='object')continue;
            if(this.allyRequests[username].requests===null)continue;

            if(typeof this.allyRequests[username].requests[type]!=='object')continue;
            if(this.allyRequests[username].requests[type]===null)continue;
            for(let req of this.allyRequests[username].requests[type]){
                req.username=username;
                requests.push(req);
            }
        }
        return requests;
    }
    /////////// CUSTOM READ methods - applies extended logic over the raw/base data ////////////////////////////////////
    /**
     * Get all the open nuke requests, where you can/should be acting this tick.
     *
     *  The request will have come from requestBarrage()
     *
     * An action will either be "observe"/"decide-launch"
     * WHEN req.action===observe you must call observeRoom(req.roomName), so you have vision next tick
     * WHEN req.action===decide-launch, you NEED vision and should fire a nuke if youngestNuke is older than req.interval
     *
     * if youngestNuke is recent, it is up to your bot to sleep for X ticks, based on req.interval
     *
     * Designed to work with requestBarrage() and allocated player launchSlots. It ensures no player launches on the same tick.
     * For any barrages that have started, and you're invited, then you'll get any task(s) for THIS tick, returned
     *
     * @returns {*} roomName keyed object of jobs
     *      e.g. {W2N3:{action:'observe',roomName:'W2N3',intervale:500...}...}
     */
    getOpenBarrageJobs(){

        if(this.myUsername===undefined)return [];

        this._parseRawData();
        let barrageJobs = {};
        this.dupCheck = {};

        for(let username in this.allyRequests){

            if(typeof this.allyRequests[username].requests!=='object')continue;
            if(typeof this.allyRequests[username].requests.barrage!=='object')continue;

            for(let req of this.allyRequests[username].requests.barrage){
                let activeReq = this._processBarrageRequest(req,username);
                if(activeReq){
                    barrageJobs[req.roomName] = activeReq;
                }
            }

        }
        if(!this.myRequests.barrage) return barrageJobs;

        for(let req of this.myRequests.barrage){
            let activeReq = this._processBarrageRequest(req,this.myUsername);
            if(activeReq){
                barrageJobs[req.roomName] = activeReq;
            }
        }

        return barrageJobs;
    }

    /**
     * provides a built-in tracker, for sleeping a request for X ticks, based on the request.interval.
     * When sleeping, it is hidden from returning out of getOpenBarrageJobs()
     * When the sleep expires, it will re-appear in calls to getOpenBarrageJobs()
     * This is just a helpful, built-in CPU saver, so you can avoid analysis CP
     * @param req
     */
    sleepBarrageRequest(req){

        this.nukeSleeps[ req.roomName ] = Game.time + req.interval;

    }
    _processBarrageRequest(req,username){
        if(req.roomName===undefined)return; // obv, we need a target
        if(req.launchSlots===undefined)return; // slots cant be rebuilt, requires single author of the order

        // set defaults
        if(req.startTick===undefined)req.startTick=DEFAULT_NUKE_BARRAGE_START_TICK;
        if(req.maxNukes===undefined)req.maxNukes=DEFAULT_NUKE_BARRAGE_MAX_NUKES;
        if(req.interval===undefined)req.interval=DEFAULT_NUKE_BARRAGE_INTERVAL;

        if(req.launchSlots[this.myUsername]===undefined)return; // you're not invited to the nuke part :'(
        if(Game.time<req.startTick)return;// barrage not starting yet
        if(this.nukeSleeps[req.roomName] && Game.time < this.nukeSleeps[req.roomName])return;// barrage not starting yet

        // two players requesting nukes on the same room. Ignore later requests
        if(this.dupCheck[req.roomName])return;
        this.dupCheck[req.roomName]=true;

        // used for modVal. req.modVal should always be partySize.
        req.modVal = Object.keys(req.launchSlots).length;

        req.username=username;// set who asked for the nuke

        // split task into tick 1 request-vision, tick 2 run-launch-checks
        // observeTick=slot[player]-1, because player needs to gain vision the tick before launching
        let observeSlot = req.launchSlots[this.myUsername]===0 ? (req.modVal-1)  : (req.launchSlots[this.myUsername]-1);
        if( Game.time % req.modVal === req.launchSlots[this.myUsername] ){
            req.action='decide-launch';
            return req;
        }
        else if( Game.time % req.modVal === observeSlot ){
            req.action='observe';
            return  req;
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Push Request methods - Publishing to Allies
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Request resource
     * @param {Object} args - a request object
     * @param {number} args.priority - 0-1 where 1 is highest consideration
     * @param {string} args.roomName
     * @param {ResourceConstant} args.resourceType
     * @param {number} args.amount - How much they want of the resource. If the responder sends only a portion of what you ask for, that's fine
     * @param {boolean} [args.terminal] - If the bot has no terminal, allies should instead haul the resources to us
     */
    requestResource(args) {
        this._setRequestByType("resource",args);
    }

    /**
     * Request help in defending a room
     * @param {Object} args - a request object
     * @param {number} args.priority - 0-1 where 1 is highest consideration
     * @param {string} args.roomName
     */
    requestDefense(args) {
        this._setRequestByType("defense",args);
    }

    /**
     * Request an attack on a specific room
     * @param {Object} args - a request object
     * @param {number} args.priority - 0-1 where 1 is highest consideration
     * @param {string} args.roomName
     */
    requestAttack(args) {
        this._setRequestByType("attack",args);
    }

    /**
     * Request a barrage of nukes on a specific room
     * @param {Object} args - a request object
     * @param {number} args.priority - 0-1 where 1 is highest consideration
     * @param {string} args.roomName - where to target
     * @param {number} args.startTick - when to start barrage (Game.time) Default: 1 (immediately)
     * @param {number} args.interval - tick spacing, between nukes Default:500
     * @param {number} args.maxNukes - how many nukes to have active in the room at one time. Default: 99999.. (~JSON.Infinity)
     * @param {array} args.invitedPlayers - array of string usernames, who you invite to nuke
     *                                 this defaults to all allies, but allows you to prevalidate
     *                                 invite a smaller list of player
     *
     * --- IF you want to join Nuke barrages ----------
     *
     * Then use getOpenBarrageJobs(), for an easy,safe solution and avoid the maths.
     *
     * If you want more control, then you should understand the below, on how to use raw barrage request data:
     *
     * ---- The following is added after --------------
     * 
     * To ensure no player launches a nuke in the same tick, each player is assigned a launch window
     * which repeats every nth tick. So if Bob, Emma & Fred want to barrage Dave, they take it in turns.
     * This leans of Game.time%modValue==players-slot
     *   if there are 3 allies, modValue=3, with slots 0,1,2
     *   if(Game.time%3===0) Bob can Fire
     *   if(Game.time%3===1) Emma can Fire
     *   if(Game.time%3===2) Fred can Fire
     *
     * The values for modVal & launchSlots are injected; not set by you. They tell players when they launch nukes.
     *
     * @extra {number} request.modVal - divisor for Game.time modulus operation e.g. Game.time%modVal==launchSlot
     * @extra {object} request.launchSlots - a map of username->tick-slot, where Game.time%modVal==launchSlot
     *                                           n.b. you get auto-included as member in the nuke party
     *
     */
    requestBarrage(args) {

        if(args.startTick===undefined)args.startTick=DEFAULT_NUKE_BARRAGE_START_TICK;
        if(args.interval===undefined)args.interval=DEFAULT_NUKE_BARRAGE_INTERVAL;
        if(args.maxNukes===undefined)args.maxNukes=DEFAULT_NUKE_BARRAGE_MAX_NUKES;

        let invitedPlayers = args.invitedPlayers?args.invitedPlayers:this.allies;
        // dont push in this data, we're going to restructure it
        delete args.invitedPlayers;

        // build the nuke plan, so all players know when they should launch
        args.launchSlots=this._buildLaunchSlots(invitedPlayers);

        args.modVal = Object.keys(args.launchSlots).length;

        this._setRequestByType("barrage",args);
    }
    _buildLaunchSlots(invitedPlayers){
        let launchSlots={};
        for(let id in invitedPlayers){
            launchSlots[ invitedPlayers[id] ]=id*1;
        }
        // we need to include the requester too, so they get a launch slot, as its highly likely they'll be firing nukes too
        launchSlots[ this.myUsername ] = invitedPlayers.length;
        return launchSlots;
    }


    /**
     * Influence allies aggresion score towards a player
     * @param {Object} args - a request object
     * @param {number} args.hate - 0-1 where 1 is highest consideration. How much you think your team should hate the player. Should probably affect combat aggression and targetting
     * @param {number} args.lastAttackedBy - The last time this player has attacked you
     */
    requestPlayer(args) {
        this._setRequestByType("player",args);
    }

    /**
     * Request help in building/fortifying a room
     * @param {Object} args - a request object
     * @param {string} args.roomName
     * @param {number} args.priority - 0-1 where 1 is highest consideration
     * @param {'build' | 'repair'} args.workType
     */
    requestWork(args) {
        this._setRequestByType("work",args);
    }

    /**
     * Request energy to a room for a purpose of making upgrading faster.
     * @param {Object} args - a request object
     * @param {number} args.maxAmount - Amount of energy needed. Should be equal to energy that needs to be put into controller for achieving goal.
     * @param {EFunnelGoalType.GCL | EFunnelGoalType.RCL7 | EFunnelGoalType.RCL8} args.goalType - What energy will be spent on. Room receiving energy should focus solely on achieving the goal.
     * @param {string} [args.roomName] - Room to which energy should be sent. If undefined resources can be sent to any of requesting player's rooms.
     */
    requestFunnel(args) {
        this._setRequestByType("funnel",args);
    }

    /**
     * Share how your bot is doing economically
     * @param {Object} args - a request object
     * @param {number} args.credits - total credits the bot has. Should be 0 if there is no market on the server
     * @param {number} args.sharableEnergy - the maximum amount of energy the bot is willing to share with allies. Should never be more than the amount of energy the bot has in storing structures
     * @param {number} [args.energyIncome] - The average energy income the bot has calculated over the last 100 ticks. Optional, as some bots might not be able to calculate this easily.
     * @param {Object.<MineralConstant, number>} [args.mineralNodes] - The number of mineral nodes the bot has access to, probably used to inform expansion
     */
    requestEcon(args) {
        this._setRequestByType("econ",args);
    }

    /**
     * Share scouting data about hostile owned rooms
     * @param {Object} args - a request object
     * @param {string} args.roomName
     * @param {string} args.playerName - The player who owns this room. If there is no owner, the room probably isn't worth making a request about
     * @param {number} args.lastScout - The last tick your scouted this room to acquire the data you are now sharing
     * @param {number} args.rcl
     * @param {number} args.energy - The amount of stored energy the room has. storage + terminal + factory should be sufficient
     * @param {number} args.towers
     * @param {number} args.avgRamprtHits
     * @param {boolean} args.terminal - does scouted room have terminal built
     */
    requestRoom(args) {
        this._setRequestByType("room",args);
    }
    _setRequestByType(type,args){
        this._updateMySegment=true;// make sure we push updates to the segment memory
        if(this.myRequests[type]===undefined)this.myRequests[type]=[];
        this.myRequests[type].push(args);
    }
}

global.SimpleAllies =  SimpleAllies;