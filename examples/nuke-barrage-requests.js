

require('../src/class.simple-allies');

const AllyChat = new SimpleAllies(['Bob','Ada','Omar'],90,'myName');


/// your loop code
AllyChat.initRun();

    let jobs = AllyChat.getOpenBarrageJobs();
    for(let roomName in jobs){
        let req=jobs[roomName];
        if(req.action==='observe'){

            // you must trigger a request vision this tick
            ScoutManager.observer(roomName); //player code
            console.log("Observing ",roomName," for barrage request from ",req.username);

        }else if(req.action==='decide-launch'){
            //  you should now have vision
            if(Game.rooms[roomName]){

                  let youngestNuke = findYoungestNuke() //player code

                 if( (NUKE_LAND_TIME - youngestNuke.timeToLand) > req.interval ){

                     fireNukeAt(roomName,"max-damage"); //player code
                     

                     console.log("FIRE!!! on ",roomName," for barrage request from ",req.username);

                 }else{
                     console.log("Not ready to fire on ",roomName," for barrage request from ",req.username, "waiting on TTL of:",youngestNuke);
                 }
                 // now we sleep this request based on interval, to save CPU on analysis
                AllyChat.sleepBarrageRequest(req);


            }else{
                // you failed to act previous tick on req.action==='observe'
                console.log("ERROR!! Observing ",roomName," for barrage request from ",req.username);
            }
        }


    }


AllyChat.endRun();
