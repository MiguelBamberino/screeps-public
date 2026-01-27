require('../src/class.simple-allies.js');
const constants = require('@screeps/common/lib/constants');
const {ERR_NOT_FOUND, ERR_INVALID_ARGS} = require("@screeps/common/lib/constants");
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
    it('simple-allies.1.2 > Your own name in allies list ',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','TestUserName','AllyB'],90,'TestUserName');
        let res = AllyChat.initRun();
        expect(res).toBe(ERR_INVALID_ARGS);
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
            'AllyA':{data:'{ "requests": { "resources": [] } }',updatedAt: 2},
            'AllyB':{data:'{ "requests": { "resources": [] } }',updatedAt: 3},
            'AllyC':{data:'{ "requests": { "resources": [] } }',updatedAt: 4},
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

            // AllyB did not set a segment, so will be missing
            'AllyA':{data:'{ "requests": { "resources": [] } }',updatedAt: 2},
            'AllyC':{data:'{ "requests": { "resources": [] } }',updatedAt: 4},
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

        // Tick 2 Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests": { "resources": [] } }'};

        // next tick we can READ allyA and set pointer to allyB
        res = AllyChat.initRun();
        expect(res).toBe(OK);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyB',90]);

        // Tick 3 Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "resources": [] } }'};

        // next tick we can READ allyB and set pointer to allyC
        res = AllyChat.initRun();
        expect(res).toBe(OK);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyC',90]);

        // Tick 4 Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyC',data:'{ "requests": { "resources": [] } }'};

        // next tick we can READ allyC and set pointer back to allyA
        res = AllyChat.initRun();
        expect(res).toBe(OK);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyA',90]);

        // Tick 5 Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests": { "defense": [{roomName:"W3N3"}] } }'};

        res = AllyChat.initRun();
        expect(res).toBe(OK);
        expect(RawMemory._fake_setActiveForeignSegment_params).toEqual(['AllyB',90]);

        expect(AllyChat.rawSegmentData).toEqual({
            'AllyA':{data:'{ "requests": { "defense": [{roomName:"W3N3"}] } }',updatedAt: 5},
            'AllyB':{data:'{ "requests": { "resources": [] } }',updatedAt: 3},
            'AllyC':{data:'{ "requests": { "resources": [] } }',updatedAt: 4},
        });
    });
});
describe('simple-allies.2 > _parseRawData()',()=> {
    it('simple-allies.2.1 > allyA sets on T2, allyB sets on T3,T5. Expect: AllyA is not reparsed. AllyB is reparsed ',()=>{

        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'TestUserName');

        // make sure this doesn't create a bug from being called too early
        expect(AllyChat._parseRawData()).toBe(0);

        // first tick, we're just assign the segment
        AllyChat.initRun();

        // make sure this doesn't create a bug from being called too early
        expect(AllyChat._parseRawData()).toBe(0);

        // Tick 2 - AllyA sets their data
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests": { "defense": [{"roomName":"W3N3"}] } }'};
        AllyChat.initRun();

        expect(AllyChat._parseRawData()).toBe(1);
        expect(AllyChat.allyRequests).toEqual({
            'AllyA':{
                requests:{defense:[{roomName:"W3N3"}]},
                _parsedAt: 2,
            }
        })

        // Tick 3 - AllyB sets their data
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "resource": [{"roomName":"W1N3","resourceType":"L"}] } }'};
        AllyChat.initRun();

        let res = AllyChat._parseRawData();
        expect(res).toBe(1);
        expect(AllyChat.allyRequests).toEqual({
            'AllyA':{
                requests:{defense:[{roomName:"W3N3"}]},
                _parsedAt: 2,
            },
            'AllyB':{
                requests:{resource:[{roomName:"W1N3",resourceType:"L"}]},
                _parsedAt: 3,
            }
        })

        // Tick 4 AllyA makes no change
        Game.time++;
        AllyChat.initRun();

        expect(AllyChat._parseRawData()).toBe(0);
        expect(AllyChat.allyRequests).toEqual({
            'AllyA':{
                requests:{defense:[{roomName:"W3N3"}]},
                _parsedAt: 2,
            },
            'AllyB':{
                requests:{resource:[{roomName:"W1N3",resourceType:"L"}]},
                _parsedAt: 3,
            }
        })

        // Tick 5 AllyB makes no change
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "resource": [{"roomName":"W1N3","resourceType":"L"},{"roomName":"W1N3","resourceType":"O"}] } }'};
        AllyChat.initRun();
        expect(AllyChat._parseRawData()).toBe(1);
        expect(AllyChat.allyRequests).toEqual({
            'AllyA':{
                requests:{defense:[{roomName:"W3N3"}]},
                _parsedAt: 2,
            },
            'AllyB':{
                requests:{resource:[{roomName:"W1N3",resourceType:"L"},{roomName:"W1N3",resourceType:"O"}]},
                _parsedAt: 5,
            }
        })

        // Tick 6, no change from any ally, expect cache is preserved
        Game.time++;
        AllyChat.initRun();

        expect(AllyChat._parseRawData()).toBe(0);
        expect(AllyChat.allyRequests).toEqual({
            'AllyA':{
                requests:{defense:[{roomName:"W3N3"}]},
                _parsedAt: 2,
            },
            'AllyB':{
                requests:{resource:[{roomName:"W1N3",resourceType:"L"},{roomName:"W1N3",resourceType:"O"}]},
                _parsedAt: 5,
            }
        })
    })
})
describe('simple-allies.3 > _getRequestsByType()',()=> {

    it('simple-allies.3.1 > ally has set segment false/null/undefined. EXPECT: This ally is skipped. ',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB','AllyC','AllyD'],90,'TestUserName');
        // first tick, we're just assign the segment
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:undefined};
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
    it('simple-allies.3.2 > ally has set requests false/null/undefined. EXPECT: This ally is skipped. ',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB','AllyC','AllyD'],90,'TestUserName');
        // first tick, we're just assign the segment
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests":undefined }'};
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
    it('simple-allies.3.3 > ally has set [funnel/barrage...] to bad data type. EXPECT: This ally is skipped. "  ',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB','AllyC','AllyD'],90,'TestUserName');
        // first tick, we're just assign the segment
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests":{"defense":undefined} }'};
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
    it('simple-allies.3.4 > ally has set the request contents to bad data type. EXPECT: This request is skipped. "  ',()=>{

        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB','AllyC','AllyD'],90,'TestUserName');
        // first tick, we're just assign the segment
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests":{"defense":[undefined]} }'};
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
    it('simple-allies.3.5 > ally has set the segment to BAD JSON. EXPECT: This request is skipped. "',()=>{

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
    it('simple-allies.3.6 > ally has set "req type" empty array. EXPECT: [] " ',()=>{

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
    it('simple-allies.3.7 > 2 allies set defense reqs, 1 ally attack req. Request defense. EXPECT: 1 array, with only defense',()=>{

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
    it('simple-allies.3.8 > Ally changes  data. EXPECT: Correct Adds,Edits,Removes from cache.',()=>{
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

describe('simple-allies.4 > getAllRequests()',()=> {

    it.todo('simple-allies.4.1 > no segment data set. Expect: basic skeleton of keyed data. ');
    it.todo('simple-allies.4.2 > mix of good & bad data. Expect: data, keyed by ally.');
    it.todo('simple-allies.4.3 > Ally does not change data. Expect: parse to cache.');
    it.todo('simple-allies.4.4 > Ally changes data on tick X, we access of tick X+3. Expect: changeTime=x, parseTime=x+3.');
    it.todo('simple-allies.4.5 > Ally changes after we have parsed. Expect: New data & parseTime=x, changeTime=x . ');
});

describe('simple-allies.5 > getOpenBarrageJobs()',()=> {

    it('simple-allies.5.1 > No barrages set. Expect: {} ',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // first tick, we're just assign the segment
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests":{"barrage":[]} }'};
        // next tick we can READ allyA and set pointer to allyB
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "defense": [{"roomName":"W3N3"}] } }'};
        // next tick we can READ allyB and set pointer to allyC
        AllyChat.initRun();
        expect(AllyChat.getOpenBarrageJobs()).toEqual({});

    });
    it('simple-allies.5.2 > barrages set, then removed. Expect: {}',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick=1, we're just assign the segment
        AllyChat.initRun();

        // AllyA has set a barrage request. team: AllyA, AllyB & logged in player(MyUserName)
        // modValue=3 for 3 members.
        // IF(T%MV==LS) THEN observer ELSE IF(T%MV==LS-1) THEN FIRE
        // MyUserName observes on T%3===1, fires T%3===2
        /* Examples:
            1%3=1
            2%3=2
            3%3=0
            4%3=1
            5%3=2
            6%3=0
         */

        // Tick=2 we can READ allyA
        Game.time++;
        let data = JSON.stringify({
                            requests:{
                                barrage:[
                                    {roomName:"W2N3",startTick:1,launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:5 }
                                ]}
                        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        AllyChat.initRun();
        // Tick=2 2%3=2, MyUserName:2, so we can launch
        expect(AllyChat.getOpenBarrageJobs()).toEqual({
            W2N3:{action:'decide-launch',roomName:"W2N3",startTick:1,launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:5,username:'AllyA' }
        });

        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyB',data:'{ "requests": { "defense": [{"roomName":"W3N3"}] } }'};
        // Tick=3, we can READ allyB and set pointer to allyA
        AllyChat.initRun();
        // Game tick over
        Game.time++;
        RawMemory.foreignSegment={username:'AllyA',data:'{ "requests":{"barrage":[]} }'};
        // next tick we can READ allyA and set pointer to allyB
        AllyChat.initRun();


        expect(AllyChat.getOpenBarrageJobs()).toEqual({});


    });
    it('simple-allies.5.3 > 1 active Barrage, player not invited. Expect: {} ',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick 1
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W2N3",startTick:1,launchSlots:{AllyA:0,AllyB:1},modVal:2,interval:250, maxNukes:5 }
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        AllyChat.initRun();
        /// Now lets cycle through 3 ticks (full-team-size) to ensure the active player is not part of nuke-team
        // Tick 3 - Game-tick over
        Game.time++;
        expect(AllyChat.getOpenBarrageJobs()).toEqual({});
        // Tick 4 - Game-tick over
        Game.time++;
        expect(AllyChat.getOpenBarrageJobs()).toEqual({});
        // Tick 5 - Game-tick over
        Game.time++;
        expect(AllyChat.getOpenBarrageJobs()).toEqual({});

    });
    it('simple-allies.5.4 > 1 active Barrage, player turn to act. Expect: {}',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick 1
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W2N3",startTick:1,launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:5 }
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        AllyChat.initRun();
        // Tick 3 - Player3 (MyUserName) is not active (3%3=0); AllyA firing, AllyB observing
        Game.time=3;
        expect(AllyChat.getOpenBarrageJobs()).toEqual({});

    });
    it('simple-allies.5.5 > 1 active Barrage, player turn to observe. Expect: request',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick 1
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W2N3",startTick:1,launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:5 }
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        AllyChat.initRun();
        // Tick 4 - Player3 (MyUserName) should observer 4%3==1.
        Game.time=4;
        let jobs = AllyChat.getOpenBarrageJobs();
        expect(jobs['W2N3']).toBeDefined();
        expect(jobs['W2N3'].action).toBe('observe');
    });
    it('simple-allies.5.6 > 1 active Barrage, player turn to launch. Expect: request',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick 1
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W2N3",startTick:1,launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:5 }
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        AllyChat.initRun();
        // Tick 5 - Player3 (MyUserName) should fire 5%3==1.
        Game.time=5;
        let jobs = AllyChat.getOpenBarrageJobs();
        expect(jobs['W2N3']).toBeDefined();
        expect(jobs['W2N3'].action).toBe('decide-launch');
    });
    it('simple-allies.5.7 > 2 active Barrage, player turn to act on one, not the other. Expect: 1 request',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick 1
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W1N3",startTick:1,launchSlots:{AllyA:2,AllyB:1,MyUserName:0},modVal:3,interval:250, maxNukes:5 },
                    {roomName:"W2N3",startTick:1,launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:5 },
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        AllyChat.initRun();
        // Tick 6 - Player3 (MyUserName) should be silent on W2N3 (6%3=0) and fire on W1N3 (6%3==0)
        Game.time=6;
        let jobs = AllyChat.getOpenBarrageJobs();
        expect(jobs['W1N3']).toBeDefined();
        expect(jobs['W2N3']).toBeUndefined();
        expect(jobs['W1N3'].action).toBe('decide-launch');
    });
    it('simple-allies.5.8 > 2 active Barrage, same room, player turn on 2nd, not 1st. Expect: NO request. Completely ignore duplicate nuke requests.',()=>{
        // Kalgen's test case
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick 1
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W1N3",startTick:1,launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:5 },
                    {roomName:"W1N3",startTick:1,launchSlots:{AllyA:2,AllyB:1,MyUserName:0},modVal:3,interval:250, maxNukes:5 },
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        AllyChat.initRun();
        // Tick 6 - Player3 (MyUserName) reqs: 1st (6%3!=2) and 2nd (6%3==0)
        Game.time=6;
        let jobs = AllyChat.getOpenBarrageJobs();
        expect(jobs['W1N3']).toBeUndefined();// we should not activate on 2nd request, as it was accepted in error
    });
    it('simple-allies.5.9 > 2 active Barrage, same room, player turn on both. Expect: 1st. Ignore 2nd (duplicate).',()=>{
        // Kalgen's test case
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick 1
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W1N3",startTick:1,launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:2 },
                    {roomName:"W1N3",startTick:1,launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:5 },
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        AllyChat.initRun();
        // Tick 5 - Player3 (MyUserName) reqs: 1st (5%3==2)
        Game.time=5;
        let jobs = AllyChat.getOpenBarrageJobs();
        expect(jobs['W1N3']).toBeDefined();
        expect(jobs['W1N3'].maxNukes).toBe(2);// we should activate on 1st request, as it was accepted in error
    });
    it('simple-allies.5.10 > 1 active Barrage, Player with LS=0. Expect: Player gets observer-slot=slots.length.',()=>{
            createFake_Game();
            createFake_RawMemory();
            let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
            // Tick 1
            AllyChat.initRun();
            // Tick 2 - Game-tick over
            Game.time++;
            let data = JSON.stringify({
                requests:{
                    barrage:[
                        {roomName:"W1N3",startTick:1,launchSlots:{MyUserName:0,AllyA:1,AllyB:2},modVal:3,interval:250, maxNukes:2 },
                    ]}
            });
            RawMemory.foreignSegment={username:'AllyA',data:data};
            AllyChat.initRun();
            // Tick 5 - Player3 (MyUserName) observes on (5%3==2), so AllyBs fire slot
            Game.time=5;
            let jobs = AllyChat.getOpenBarrageJobs();
            expect(jobs['W1N3']).toBeDefined();
            expect(jobs['W1N3'].action).toBe("observe");
    });
    it('simple-allies.5.11 > Complicated logic stress test. Expect: Player to only get a row on correct turn.',()=>{
        // ergh, this ones going to be a PITA
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB','AllyC','AllyD'],90,'MyUserName');
        // Tick 1 - player loop
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W1N3",launchSlots:{AllyA:0,AllyB:1,MyUserName:2},interval:250, maxNukes:10 },
                    {roomName:"W4E3",launchSlots:{AllyC:0,AllyB:1},interval:250, maxNukes:10 },
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        // Tick 2 - player loop
        AllyChat.initRun();
        // Tick 3 - Game-tick over
        Game.time++;
        data = JSON.stringify({
            requests:{
                barrage:[
                    // a lovely out of order big party
                    {roomName:"W2N2",launchSlots:{AllyA:0,MyUserName:1,AllyC:2,AllyB:3,AllyD:4},interval:5500,maxNukes:50 },
                ]}
        });
        RawMemory.foreignSegment={username:'AllyB',data:data};
        // Tick 3 - player loop
        AllyChat.initRun();
        // Tick 4 - Game-tick over
        Game.time++;
        data = JSON.stringify({
            requests:{
                defense:[
                    {roomName:"E1N3" },
                ]}
        });
        RawMemory.foreignSegment={username:'AllyC',data:data};
        // Tick 4 - player loop
        AllyChat.initRun();


        // fast-forward ticks for nuke jobs
        Game.time=4;
        let jobs = AllyChat.getOpenBarrageJobs();
        expect(jobs['W1N3']).toBeDefined();
        expect(jobs['W1N3'].action).toBe("observe");
        expect(jobs['W4E3']).toBeUndefined(); // not in the party
        expect(jobs['W2N2']).toBeUndefined(); // not your turn; Ally D launch & A observe

        Game.time=5;
        jobs = AllyChat.getOpenBarrageJobs();

        expect(jobs['W1N3']).toBeDefined();
        expect(jobs['W1N3'].action).toBe("decide-launch");

        expect(jobs['W4E3']).toBeUndefined(); // not in the party
        expect(jobs['W2N2']).toBeDefined();
        expect(jobs['W2N2'].action).toBe("observe"); // 5%5==0

        Game.time=6;
        jobs = AllyChat.getOpenBarrageJobs();
        expect(jobs['W1N3']).toBeUndefined();  // not your turn; Ally A & B
        expect(jobs['W4E3']).toBeUndefined(); // not in the party
        expect(jobs['W2N2']).toBeDefined();
        expect(jobs['W2N2'].action).toBe("decide-launch"); // 6%5==1


    });
    it('simple-allies.5.12 > Barrages with startTick >= Game.time Expect: request is ignored.',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick 1
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W1N3",startTick:4,launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:2 },
                    {roomName:"W2N3",startTick:5,launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:5 },
                    {roomName:"W3N3",startTick:6,launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:5 },
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        AllyChat.initRun();
        // Tick 5 - Player3 (MyUserName) fires (5%3==2)
        Game.time=5;
        let jobs = AllyChat.getOpenBarrageJobs();
        expect(jobs['W1N3']).toBeDefined();
        expect(jobs['W2N3']).toBeDefined();
        expect(jobs['W3N3']).toBeUndefined();
    });
    it('simple-allies.5.13 > Barrages with !startTick,  !maxNukes, !interval, !modVal, !launchSlots Expect: Assumed defaults.',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick 1
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W1N3", launchSlots:{AllyA:0,AllyB:1,MyUserName:2} },
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        AllyChat.initRun();
        // Tick 5 - Player3 (MyUserName) fires on (5%3==0)
        Game.time=5;
        let jobs = AllyChat.getOpenBarrageJobs();
        expect(jobs['W1N3']).toBeDefined();
        expect(jobs['W1N3'].startTick).toBe(1);
        expect(jobs['W1N3'].maxNukes).toBe(999);
        expect(jobs['W1N3'].interval).toBe(500);
        expect(jobs['W1N3'].modVal).toBe(3);
        expect(jobs['W1N3'].action).toBe('decide-launch');
    });
    it('simple-allies.5.14 > Barrages with !launchSlots Expect: request is ignored. launchSlots CANNOT be rebuilt on client-side',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick 1
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W1N3",interval:250, maxNukes:4 },
                    {roomName:"W2N3",launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:2 },
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        AllyChat.initRun();
        // Tick 5 - Player3 (MyUserName) fires (5%3==2)
        Game.time=5;
        let jobs = AllyChat.getOpenBarrageJobs();
        expect( Object.keys(jobs).length ).toBe(1);
        expect(jobs['W2N3']).toBeDefined();
        expect(jobs['W2N3'].maxNukes).toBe(2);
    });
    it('simple-allies.5.15 > Barrages with !roomName Expect: request is ignored...obv',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick 1
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W1N3",launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:2 },
                    {launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:3,interval:250, maxNukes:3 },
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        AllyChat.initRun();
        // Tick 5 - Player3 (MyUserName) fires (5%3==2)
        Game.time=5;
        let jobs = AllyChat.getOpenBarrageJobs();
        expect( Object.keys(jobs).length ).toBe(1);
        expect(jobs['W1N3']).toBeDefined();
        expect(jobs['W1N3'].maxNukes).toBe(2);
    });

    it('simple-allies.5.16 > Barrages with modVal!=launchSlots.length Expect: Ignored and launchSlots.length is used',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick 1
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W1N3",launchSlots:{AllyA:0,AllyB:1,MyUserName:2},modVal:5,interval:250, maxNukes:2 },
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        AllyChat.initRun();
        // Tick 5 - Player3 (MyUserName) fires (5%3==2), ignoring modVal:5 (5%5==0)
        // if the code used modVal 5, then we'd get no request of tick 5
        Game.time=5;
        let jobs = AllyChat.getOpenBarrageJobs();
        expect( Object.keys(jobs).length ).toBe(1);
        expect(jobs['W1N3']).toBeDefined();
        expect(jobs['W1N3'].action).toBe("decide-launch");
        expect(jobs['W1N3'].maxNukes).toBe(2);
    });
    it('simple-allies.5.17 > You request your own barrage,  Expect: You must be included in the launch slots and nuke jobs',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick 1
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W1N3",launchSlots:{AllyA:2,AllyB:1,MyUserName:0},interval:250, maxNukes:2 },
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        // Tick 2 - Player loop
        AllyChat.initRun();
        AllyChat.requestBarrage({roomName:'W2N1'})
        AllyChat.endRun();

        // SOME time passes
        Game.time++;  // Tick 3
        AllyChat.initRun();
        AllyChat.endRun();
        Game.time++;  // Tick 4
        AllyChat.initRun();
        AllyChat.endRun();
        Game.time++;  // Tick 5

        // Tick 5 - Player3 (MyUserName) should have been appended to the nuke slots at slot=2
        // Player3 fires (5%3==2) on W2N1 and observes (4%3==1) on W2N1
        // if the code used modVal 5, then we'd get no request of tick 5

        let jobs = AllyChat.getOpenBarrageJobs();
        expect(jobs['W1N3']).toBeDefined();
        expect(jobs['W1N3'].action).toBe("observe"); // (5%3==2) observe, (6%3==0) fire
        expect(jobs['W1N3'].maxNukes).toBe(2);

        expect(jobs['W2N1']).toBeDefined();
        expect(jobs['W2N1'].launchSlots).toEqual({AllyA:0,AllyB:1,MyUserName:2});
        expect(jobs['W2N1'].action).toBe("decide-launch"); // (5%3==2) fire, (4%3==1) observe
        expect(jobs['W2N1'].maxNukes).toBe(999);
    });

    it('simple-allies.5.18 > using sleepBarrageRequest(),  Expect: The job to stay dormant until its time',()=>{
        createFake_Game();
        createFake_RawMemory();
        let AllyChat = new SimpleAllies(['AllyA','AllyB'],90,'MyUserName');
        // Tick 1
        AllyChat.initRun();
        // Tick 2 - Game-tick over
        Game.time++;
        let data = JSON.stringify({
            requests:{
                barrage:[
                    {roomName:"W1N3",launchSlots:{AllyA:2,AllyB:1,MyUserName:0},interval:250, maxNukes:2 },
                ]}
        });
        RawMemory.foreignSegment={username:'AllyA',data:data};
        // Tick 2 - Player loop
        AllyChat.initRun();
        AllyChat.requestBarrage({roomName:'W2N1'})
        AllyChat.endRun();

        // SOME time passes
        Game.time++;  // Tick 3
        AllyChat.initRun();
        AllyChat.endRun();
        Game.time++;  // Tick 4
        AllyChat.initRun();
        AllyChat.endRun();
        Game.time++;  // Tick 5

        // Tick 5 - Player3 (MyUserName) should have been appended to the nuke slots at slot=2
        // Player3 fires (5%3==2) on W2N1 and observes (4%3==1) on W2N1
        // if the code used modVal 5, then we'd get no request of tick 5

        let jobs = AllyChat.getOpenBarrageJobs();
        expect(jobs['W1N3']).toBeDefined();
        expect(jobs['W1N3'].action).toBe("observe"); // (5%3==2) observe, (6%3==0) fire
        expect(jobs['W1N3'].maxNukes).toBe(2);
        AllyChat.sleepBarrageRequest(jobs['W1N3']);

        expect(jobs['W2N1']).toBeDefined();
        expect(jobs['W2N1'].launchSlots).toEqual({AllyA:0,AllyB:1,MyUserName:2});
        expect(jobs['W2N1'].action).toBe("decide-launch"); // (5%3==2) fire, (4%3==1) observe
        expect(jobs['W2N1'].maxNukes).toBe(999);
        AllyChat.sleepBarrageRequest(jobs['W2N1']);
        for(let t=5; t<255; t++){
            Game.time = t;
            jobs = AllyChat.getOpenBarrageJobs();
            expect(jobs).toEqual({});
        }
        Game.time = 255;// job W1N3 wakes up
        jobs = AllyChat.getOpenBarrageJobs();
        expect(jobs['W1N3']).toBeDefined(); // 255%3==0, MyUserName fires on 0, observes on 2
        expect(jobs['W1N3'].action).toBe("decide-launch");
        expect(jobs['W2N1']).toBeUndefined(); // 255%3==0, MyUserName fires on 2, observes on 1 BUT still 250t of sleep

        Game.time = 251;
        jobs = AllyChat.getOpenBarrageJobs();
        expect(jobs['W1N3']).toBeUndefined(); // 256%3==1, MyUserName fires on 0, observes on 2

        expect(jobs['W2N1']).toBeUndefined(); // 251%3==1, MyUserName fires on 2, observes on 1 BUT still 250t of sleep
    });
});