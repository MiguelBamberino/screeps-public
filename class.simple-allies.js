

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
 */
class SimpleAllies {

    /**
     *
     * @param array allies list of player usernames
     * @param number segID the segment that you all share
     */
    constructor(allies,segID) {
        this.allies = allies;
        this._parsed = false;
        // This is the conventional segment used for team communication
        this.allySegmentID=segID;

        this.rawSegmentData={};
        this.allyRequests={};

        // Reset the data of myRequests
        this.myRequests = {
            resource: [],
            defense: [],
            attack: [],
            barrage: [],
            player: [],
            work: [],
            funnel: [],
            room: [],
        };
        // get us set up, during the global reset
        RawMemory.setPublicSegments([segID]);

    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Utility  methods - Handling segment data
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    tickStart() {
        this._parsed = false;
        return this._readAllySegment();
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

    /**
     * To call after requests have been made, to assign requests to the next ally
     */
    endRun() {
        // TODO: I need to change this to work with new Memory model
        // Make sure we don't have too many segments open
        if (Object.keys(RawMemory.segments).length >= maxSegmentsOpen) {
            throw Error('Too many segments open: simpleAllies');
        }
        const newSegmentData = {
            requests: this.myRequests
        };
        RawMemory.segments[this.allySegmentID] = JSON.stringify(newSegmentData);

    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Read Request methods - Reading requests from Allies
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    getFunnelRequests() {return this._getRequestsByType('funnel');}
    getResourceRequests() {return this._getRequestsByType('resource');}
    getAttackRequests() {return this._getRequestsByType('attack');}
    getBarrageRequests() {return this._getRequestsByType('barrage');}
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

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Push Request methods - Publishing to Allies
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
        this.myRequests.resource.push(args);
    }

    /**
     * Request help in defending a room
     * @param {Object} args - a request object
     * @param {number} args.priority - 0-1 where 1 is highest consideration
     * @param {string} args.roomName
     */
    requestDefense(args) {
        this.myRequests.defense.push(args);
    }

    /**
     * Request an attack on a specific room
     * @param {Object} args - a request object
     * @param {number} args.priority - 0-1 where 1 is highest consideration
     * @param {string} args.roomName
     */
    requestAttack(args) {
        this.myRequests.attack.push(args);
    }

    /**
     * Request a barrage of nukes on a specific room
     * @param {Object} args - a request object
     * @param {number} args.priority - 0-1 where 1 is highest consideration
     * @param {string} args.roomName - where to target
     * @param {number} args.startTick - when to start barrage (Based on Game.time)
     * @param {number} args.interval - tick spacing, between nukes
     * @param {number} args.maxNukes - how many nukes to have active in the room at one time
     * @param {number} args.modVal - divisor for Game.time modulus operation
     * @param {object} args.playerLaunchSlots - a map of username->tick-slot, where Game.time%25==slot
     *                                          e.g. { bob:3, emma:4, fred:5 },
     *                                          emma only fires when Game.time%25==4
     *                                          fred only fires when Game.time%25==5
     */
    requestBarrage(args) {

        if(typeof args.playerLaunchSlots === 'undefined'){
            args.playerLaunchSlots={};
            for(let id in this.allies){
                args.playerLaunchSlots[ this.allies[id] ]=id;
            }
        }
        args.modVal = Object.keys(args.playerLaunchSlots).length;

        this.myRequests.barrage.push(args);
    }


    /**
     * Influence allies aggresion score towards a player
     * @param {Object} args - a request object
     * @param {number} args.hate - 0-1 where 1 is highest consideration. How much you think your team should hate the player. Should probably affect combat aggression and targetting
     * @param {number} args.lastAttackedBy - The last time this player has attacked you
     */
    requestPlayer(args) {
        this.myRequests.player.push(args);
    }

    /**
     * Request help in building/fortifying a room
     * @param {Object} args - a request object
     * @param {string} args.roomName
     * @param {number} args.priority - 0-1 where 1 is highest consideration
     * @param {'build' | 'repair'} args.workType
     */
    requestWork(args) {
        this.myRequests.work.push(args);
    }

    /**
     * Request energy to a room for a purpose of making upgrading faster.
     * @param {Object} args - a request object
     * @param {number} args.maxAmount - Amount of energy needed. Should be equal to energy that needs to be put into controller for achieving goal.
     * @param {EFunnelGoalType.GCL | EFunnelGoalType.RCL7 | EFunnelGoalType.RCL8} args.goalType - What energy will be spent on. Room receiving energy should focus solely on achieving the goal.
     * @param {string} [args.roomName] - Room to which energy should be sent. If undefined resources can be sent to any of requesting player's rooms.
     */
    requestFunnel(args) {
        this.myRequests.funnel.push(args);
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
        this.myRequests.econ = args;
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
        this.myRequests.room.push(args);
    }
}

global.SimpleAllies =  SimpleAllies;