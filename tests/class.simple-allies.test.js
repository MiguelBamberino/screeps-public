require('../src/class.simple-allies.js');
const constants = require('@screeps/common/lib/constants');
const {ERR_NOT_FOUND} = require("@screeps/common/lib/constants");
// Append each attribute from the module to the global scope
Object.assign(global, constants);

createFake_Game = ()=> {
    global.Game = {time:1};
}
createFake_RawMemory = ()=> {
    global.RawMemory = {
        segments:{},
        foreignSegment:{},
        _fake_setPublicSegments_params:'not-called',
        _fake_setActiveForeignSegment_params:'not-called',
        setPublicSegments:(ids=[])=>{
            // not sure why this.* doesnt work. I think 'this' is referring to the func not obj
            RawMemory._fake_setPublicSegments_params=ids;
        },
        setActiveForeignSegment:(username,id)=>{
            RawMemory._fake_setActiveForeignSegment_params=[username,id];
        },
    }
}

describe('simple-allies.0 > constructor()',()=> {
    it('simple-allies.0.1 > basics ',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies([],90,'TestUserName');
        expect(RawMemory._fake_setPublicSegments_params).toEqual([90]);

        global.fakeLogs =[];
        AllyChat.setLogger(function(level,category,msg,subject){
            fakeLogs.push({level,category,msg,subject});
        })
        AllyChat._log('INFO',"test-category","test-msg","test-subject");
        expect(fakeLogs.length).toBe(1);
        expect(fakeLogs[0]).toEqual({level:'INFO',category:'test-category',msg:'test-msg',subject:'test-subject'});

        let AllyChat2 = new SimpleAllies([],45,'TestUserName');
        expect(RawMemory._fake_setPublicSegments_params).toEqual([45]);
    });
});

describe('simple-allies.1 > initRun()',()=> {

    it('simple-allies.1.1 > no allies ',()=>{
            createFake_Game();
            createFake_RawMemory();
            let AllyChat = new SimpleAllies([],90,'TestUserName');
            let res = AllyChat.initRun();
            expect(res).toBe(ERR_NOT_FOUND);
        });
    it('simple-allies.1.2 > first tick, no foreignSegment. So set to ally[0] ',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'TestUserName');
        let res = AllyChat.initRun();
        expect(res).toBe(ERR_TIRED);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyA',90]);
    });
    it('simple-allies.1.3 > all allies valid. roll through, reading everyone ',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB','AllyC'],90,'TestUserName');
        // first tick, we're just assign the segment
        let res = AllyChat.initRun();
        expect(res).toBe(ERR_TIRED);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyA',90]);

        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests": { "resources": [] } }'};

        // next tick we can READ allyA and set pointer to allyB
        res = AllyChat.initRun();
        expect(res).toBe(OK);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyB',90]);

        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "resources": [] } }'};

        // next tick we can READ allyB and set pointer to allyC
        res = AllyChat.initRun();
        expect(res).toBe(OK);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyC',90]);

        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyC',data:'{ "requests": { "resources": [] } }'};

        // next tick we can READ allyC and set pointer back to allyA
        res = AllyChat.initRun();
        expect(res).toBe(OK);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyA',90]);

        expect(AllyChat.rawSegmentData).toEqual({
            'AllyA':'{ "requests": { "resources": [] } }',
            'AllyB':'{ "requests": { "resources": [] } }',
            'AllyC':'{ "requests": { "resources": [] } }',
        });
    });
    it('simple-allies.1.4 > one ally has no segment ',()=>{

        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB','AllyC'],90,'TestUserName');
        // first tick, we're just assign the segment
        let res = AllyChat.initRun();
        expect(res).toBe(ERR_TIRED);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyA',90]);

        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests": { "resources": [] } }'};

        // next tick we can READ allyA and set pointer to allyB
        res = AllyChat.initRun();
        expect(res).toBe(OK);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyB',90]);

        // Game tick over
        Game.time++;


        // next tick we can READ allyB and set pointer to allyC
        res = AllyChat.initRun();
        expect(res).toBe(ERR_NOT_FOUND);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyC',90]);

        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyC',data:'{ "requests": { "resources": [] } }'};

        // next tick we can READ allyC and set pointer back to allyA
        res = AllyChat.initRun();
        expect(res).toBe(OK);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyA',90]);

        expect(AllyChat.rawSegmentData).toEqual({
            'AllyA':'{ "requests": { "resources": [] } }',
            'AllyB':undefined,
            'AllyC':'{ "requests": { "resources": [] } }',
        });

    });
    it('simple-allies.1.5 > Ally changes  data. ',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB','AllyC'],90,'TestUserName');
        // first tick, we're just assign the segment
        let res = AllyChat.initRun();
        expect(res).toBe(ERR_TIRED);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyA',90]);

        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests": { "resources": [] } }'};

        // next tick we can READ allyA and set pointer to allyB
        res = AllyChat.initRun();
        expect(res).toBe(OK);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyB',90]);

        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "resources": [] } }'};

        // next tick we can READ allyB and set pointer to allyC
        res = AllyChat.initRun();
        expect(res).toBe(OK);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyC',90]);

        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyC',data:'{ "requests": { "resources": [] } }'};

        // next tick we can READ allyC and set pointer back to allyA
        res = AllyChat.initRun();
        expect(res).toBe(OK);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyA',90]);

        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests": { "defense": [{roomName:"W3N3"}] } }'};

        res = AllyChat.initRun();
        expect(res).toBe(OK);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyB',90]);

        expect(AllyChat.rawSegmentData).toEqual({
            'AllyA':'{ "requests": { "defense": [{roomName:"W3N3"}] } }',
            'AllyB':'{ "requests": { "resources": [] } }',
            'AllyC':'{ "requests": { "resources": [] } }',
        });
    });
});

describe('simple-allies.2 > _getRequestsByType()',()=> {

    it('simple-allies.2.1 > ally has set segment false/null/undefined. EXPECT: This ally is skipped. ',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB','AllyC','AllyD'],90,'TestUserName');
        // first tick, we're just assign the segment
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:undefined};
        // next tick we can READ allyA and set pointer to allyB
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "defense": [{"roomName":"W3N3"}] } }'};
        // next tick we can READ allyB and set pointer to allyC
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyC',data:false};
        // next tick we can READ allyC and set pointer to AllyD
         AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyD',data:null};
        // next tick we can READ AllyD and set pointer back to allyA
        AllyChat.initRun();
        let reqs = AllyChat._getRequestsByType('defense');
        expect(reqs).toEqual([{roomName:"W3N3",username:'AllyB'}]);
    });
    it('simple-allies.2.2 > ally has set requests false/null/undefined. EXPECT: This ally is skipped. ',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB','AllyC','AllyD'],90,'TestUserName');
        // first tick, we're just assign the segment
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests":undefined }'};
        // next tick we can READ allyA and set pointer to allyB
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "defense": [{"roomName":"W3N3"}] } }'};
        // next tick we can READ allyB and set pointer to allyC
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyC',data:'{ "requests":false }'};
        // next tick we can READ allyC and set pointer to AllyD
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyD',data:'{ "requests":null }'};
        // next tick we can READ AllyD and set pointer back to allyA
        AllyChat.initRun();

        expect(AllyChat._getRequestsByType('defense')).toEqual([{roomName:"W3N3",username:'AllyB'}]);
    });
    it('simple-allies.2.3 > ally has set [funnel/barrage...] to bad data type. EXPECT: This ally is skipped. "  ',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB','AllyC','AllyD'],90,'TestUserName');
        // first tick, we're just assign the segment
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests":{"defense":undefined} }'};
        // next tick we can READ allyA and set pointer to allyB
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "defense": [{"roomName":"W3N3"}] } }'};
        // next tick we can READ allyB and set pointer to allyC
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyC',data:'{ "requests":"defense":false }'};
        // next tick we can READ allyC and set pointer to AllyD
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyD',data:'{ "requests":"defense":null }'};
        // next tick we can READ AllyD and set pointer back to allyA
        AllyChat.initRun();

        expect(AllyChat._getRequestsByType('defense')).toEqual([{roomName:"W3N3",username:'AllyB'}]);
    });
    it('simple-allies.2.4 > ally has set the request contents to bad data type. EXPECT: This request is skipped. "  ',()=>{

        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB','AllyC','AllyD'],90,'TestUserName');
        // first tick, we're just assign the segment
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests":{"defense":[undefined]} }'};
        // next tick we can READ allyA and set pointer to allyB
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "defense": [{"roomName":"W3N3"}] } }'};
        // next tick we can READ allyB and set pointer to allyC
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyC',data:'{ "requests":"defense":[false] }'};
        // next tick we can READ allyC and set pointer to AllyD
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyD',data:'{ "requests":"defense":[null] }'};
        // next tick we can READ AllyD and set pointer back to allyA
        AllyChat.initRun();

        expect(AllyChat._getRequestsByType('defense')).toEqual([{roomName:"W3N3",username:'AllyB'}]);


    });
    it('simple-allies.2.5 > ally has set the segment to BAD JSON. EXPECT: This request is skipped. "',()=>{

        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'TestUserName');
        // first tick, we're just assign the segment
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests":{no_comma:[undefined]} }'};
        // next tick we can READ allyA and set pointer to allyB
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "defense": [{"roomName":"W3N3"}] } }'};
        // next tick we can READ allyB and set pointer to allyC
        AllyChat.initRun();

        expect(AllyChat._getRequestsByType('defense')).toEqual([{roomName:"W3N3",username:'AllyB'}]);

    });
    it('simple-allies.2.6 > ally has set "req type" empty array. EXPECT: [] " ',()=>{

        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'TestUserName');
        // first tick, we're just assign the segment
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests":{"defense":[]} }'};
        // next tick we can READ allyA and set pointer to allyB
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "defense": [] } }'};
        // next tick we can READ allyB and set pointer to allyC
        AllyChat.initRun();

        expect(AllyChat._getRequestsByType('defense')).toEqual([]);

    });
    it('simple-allies.2.7 > 2 allies set defense reqs, 1 ally attack req. Request defense. EXPECT: 1 array, with only defense',()=>{

        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'TestUserName');
        // first tick, we're just assign the segment
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests":{"defense": [{"roomName":"W2N3"}],"attack": [{"roomName":"W6N3"}] } }'};
        // next tick we can READ allyA and set pointer to allyB
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "defense": [{"roomName":"W3N3"}] } }'};
        // next tick we can READ allyB and set pointer to allyC
        AllyChat.initRun();

        expect(AllyChat._getRequestsByType('defense')).toEqual([
            {roomName:"W2N3",username:'AllyA'},
            {roomName:"W3N3",username:'AllyB'},
        ]);

    });
    it('simple-allies.2.8 > Ally changes  data. EXPECT: Correct Adds,Edits,Removes from cache.',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'TestUserName');
        // first tick, we're just assign the segment
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests":{"defense": [{"roomName":"W2N3"}],"attack": [{"roomName":"W6N3"}] } }'};
        // next tick we can READ allyA and set pointer to allyB
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "defense": [{"roomName":"W3N3"}] } }'};
        // next tick we can READ allyB and set pointer
        AllyChat.initRun();

        expect(AllyChat._getRequestsByType('defense')).toEqual([
            {roomName:"W2N3",username:'AllyA'},
            {roomName:"W3N3",username:'AllyB'},
        ]);

        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests":{"defense": [{"roomName":"W4N3"}],"attack": [{"roomName":"W6N3"}] } }'};
        AllyChat.initRun();

        expect(AllyChat._getRequestsByType('defense')).toEqual([
            {roomName:"W4N3",username:'AllyA'},
            {roomName:"W3N3",username:'AllyB'},
        ]);
    });
});

describe('simple-allies.3 > getAllRequests()',()=> {

    it.todo('simple-allies.3.1 > no segment data set. Expect: basic skeleton of keyed data. ');
    it.todo('simple-allies.3.2 > mix of good & bad data. Expect: data, keyed by ally.');
    it.todo('simple-allies.3.3 > Ally does not change data. Expect: parse to cache.');
    it.todo('simple-allies.3.4 > Ally changes data on tick X, we access of tick X+3. Expect: changeTime=x, parseTime=x+3.');
    it.todo('simple-allies.3.5 > Ally changes after we have parsed. Expect: New data & parseTime=x, changeTime=x . ');
});

describe('simple-allies.4 > getOpenBarrageJobs()',()=> {

    it.todo('simple-allies.4.1 > No barrages set. Expect: {} ');
    it.todo('simple-allies.4.2 > barrages set, then removed. Expect: {}');
    it.todo('simple-allies.4.3 > 1 active Barrage, player not invited. Expect: {} ');
    it.todo('simple-allies.4.4 > 1 active Barrage, not player turn to act. Expect: {}');
    it.todo('simple-allies.4.5 > 1 active Barrage, player turn to observe. Expect: request');
    it.todo('simple-allies.4.6 > 1 active Barrage, player turn to launch. Expect: request');
    it.todo('simple-allies.4.7 > 2 active Barrage, player turn to act on one. Expect: 1 request');
    it.todo('simple-allies.4.8 > 2 active Barrage, same room, player turn on 2nd, not 1st. Expect: NO request. We need to completely ignore duplicate requests.');
    it.todo('simple-allies.4.9 > 2 active Barrage, same room, player turn on both. Expect: 1st. Ignore 2nd (duplicate).');
    it.todo('simple-allies.4.9 > 2 active Barrage, same room, player turn on both. Expect: 1st. Ignore 2nd (duplicate).');
});