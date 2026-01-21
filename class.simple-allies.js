

// This isn't in the docs for some reason, so we need to add it
const maxSegmentsOpen = 10;

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
 * - local stashing of all aly data, so that you can access Ally requests when you can't see their segment
 * - CPU improvements, by on storing raw string data and parsing JSON on demand.
 * - added requestBarrage(), working with SneakyPolarBear (https://github.com/ztomlord)
 * - Added read wrappers for making it easier for player bots to access/filter what they want to read
 * - added log support, for player bots to hook their logger in. Instead of console.log()
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
        this.myUsername = myUsername;
        this._parsed = false;
        this._writeMyRequestsEveryTick = writeMyRequestsEveryTick;
        // This is the conventional segment used for team communication
        this.allySegmentID=segID;

        this.rawSegmentData={};
        this.allyRequests={};

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
        this._parsed = false;

        // Reset the HEAP data of myRequests, ready for the bot to add new requests this tick
        this.myRequests = {};
        // to save CPU, we won't write out to the segment, unless forced
        this._updateMySegment = this._writeMyRequestsEveryTick;

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
                    // Protect from errors as we try to get ally segment data
                    this.allyRequests[username] = JSON.parse(data);
                }catch (e) {
                    this._log("ERROR", "simple-allies", "Error reading segment for Ally:"+username, 'parse-data')
                }
            }
        }
        this._parsed = true;
    }
    /**
     * Read current foreignSegment & move pointer for next read
     */
    _readAllySegment() {
        if (!this.allies.length) {
            this._log('VERBOSE',"simple-allies","No Allies set","read-segment")
            return ERR_NOT_FOUND;
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
        this.rawSegmentData[currentAllyUsername] = RawMemory.foreignSegment.data;
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
    getRawRequests(){
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
            if(typeof this.allyRequests[username].requests[type]!=='object')continue;
            for(let req of this.allyRequests[username].requests[type]){
                req.username=username;
                requests.push(req);
            }
        }
        return requests;
    }
    /////////// CUSTOM READ methods - applies extended logic over the raw/base data ////////////////////////////////////
    /**
     * Get all the open nuke requests, where you can/should fire THIS tick
     *
     * Designed to work with requestBarrage() and allocated player launchSlots. It ensures no player launches on the same tick.
     * For any barrages; that has started, and you're invited, and this tick is your launch slot, then the request is included
     *
     * @returns {*[]}
     */
    getOpenBarrageSlots(){

        if(this.myUsername===undefined)return [];

        this._parseRawData();
        let requests = [];

        for(let username in this.allyRequests){

            if(typeof this.allyRequests[username].requests!=='object')continue;
            if(typeof this.allyRequests[username].requests.barrage!=='object')continue;

            for(let req of this.allyRequests[username].requests.barrage){
                req.username=username;
                if(req.modVal===undefined)continue; // request was not set correctly. ignore
                if(req.launchSlots===undefined)continue; // request was not set correctly. ignore
                if(req.launchSlots[this.myUsername]===undefined)continue; // you're not invited to the nuke part :'(
                if(req.startTick===undefined)req.startTick=0; // not-set means fire asap
                if(Game.time<req.startTick)continue;// barrage not starting yet

                if( Game.time % req.modVal === req.launchSlots[this.myUsername] ){
                    requests.push(req);
                }
            }
        }
        return requests;
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
     * @param {number} args.startTick - when to start barrage (Game.time) Default: current-game-time
     * @param {number} args.interval - tick spacing, between nukes Default:500
     * @param {number} args.maxNukes - how many nukes to have active in the room at one time. Default:999 (~JSON.Infinity)
     * @param {array} args.invitedPlayers - array of string usernames, who you invite to nuke
     *                                 this defaults to all allies, but allows you to prevalidate
     *                                 invite a smaller list of player
     *
     * ---- The following is added after --------------
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
     *
     */
    requestBarrage(args) {

        if(args.startTick===undefined)args.startTick=Game.time;
        if(args.interval===undefined)args.interval=500;
        if(args.maxNukes===undefined)args.maxNukes=999;

        let invitedPlayers = args.invitedPlayers?args.invitedPlayers:this.allies;
        // dont push in this data, we're going to restructure it
        delete args.invitedPlayers;

        // build the nuke plan, so all players know when they should launching
        args.launchSlots={};
        for(let id in invitedPlayers){
            args.launchSlots[ invitedPlayers[id] ]=id;
        }
        args.modVal = Object.keys(args.launchSlots).length;

        this._setRequestByType("barrage",args);
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