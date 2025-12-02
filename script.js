/// Things Todo: Add offline time calculation, Add posibility to view baros offerings??????, Test in real life enviorment
// get html elements
const countdownEl = document.getElementById("countdown")
//const og_timeEL = document.getElementById("og_time") // removed bc it looked bad
const timeEL = document.getElementById("time")
const timer_imageEL = document.getElementById("timer_image")
const target_planet_imageEL = document.getElementById("target_planet")
const baro_timer_textEL = document.getElementById("baro_text")
const void_imageEL = document.getElementById("void")
const white_line_imageEL = document.getElementById("white_line")
const baros_shipEL = document.getElementById("baros_ship")
const topSpaceEL = document.getElementById("top_space")
const internetWarningEL = document.getElementById("internet_warning")
const internetWarningParentEL = document.getElementById("internet_warning_parent")

// declare setting variables
var time_formatting = "poe"
var time_show_seconds = true

var baro_countdown_formatting = "poe"
var baro_countdown_show_seconds = true
var enable_baro_animation = true

// set all parts of the baro animation to invisible for a nice fade-in animation
target_planet_imageEL.style.opacity = "" + 0
white_line_imageEL.style.opacity = "" + 0
baros_shipEL.style.opacity = "" + 0
void_imageEL.style.opacity = "" + 0

// declare resource array
const planets = {
    "unknown": "planets/unknown.png",
    "mercury": "planets/mercury.png",
    "venus": "planets/venus.png",
    "earth": "planets/earth.png",
    "saturn": "planets/saturn.png",
    "europa": "planets/europa.png",
    "eris": "planets/eris.png",
    "pluto": "planets/pluto.png"
}

// declare global variables
var target_planet
var last_target_planet

// offline schedule calculator for Baro K'Teer
function calculateScheduleOffline(anchorActivationISO = "2023-02-12T13:00:00Z", planetOffset = 0) {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const CYCLE_DAYS = 14;      // Baro arrives every 2 weeks
    const ACTIVE_DAYS = 2;      // stays for 48 hours
    const PLANETS = ["Earth", "Mercury", "Saturn", "Pluto"];

    // Anchor event (a known arrival) in UTC
    const anchorActivation = new Date(anchorActivationISO);
    const nowUTC = new Date(Date.now()); // current UTC reference (ISO math uses UTC internally)

    // How many full 14-day cycles have passed since anchor
    const diffMs = nowUTC.getTime() - anchorActivation.getTime();
    const cycles = Math.floor(diffMs / (CYCLE_DAYS * MS_PER_DAY));

    // Compute current/next activation + expiry


    let currentExpiry = new Date(anchorActivation.getTime() + cycles * CYCLE_DAYS * MS_PER_DAY);
    let currentActivation = new Date(currentExpiry.getTime() - ACTIVE_DAYS * MS_PER_DAY);

    // If current period already ended, move to next cycle
    if (nowUTC >= currentExpiry) {
        currentExpiry = new Date(currentExpiry.getTime() + CYCLE_DAYS * MS_PER_DAY);
        currentActivation = new Date(currentExpiry.getTime() - ACTIVE_DAYS * MS_PER_DAY);
    }

    // Planet rotation (4-planet sequence with optional offset)
    const planetIndex = (cycles + planetOffset) % PLANETS.length;
    const location = `${PLANETS[planetIndex]} Relay (${PLANETS[planetIndex]})`;

    console.log("Now UTC:", nowUTC.toISOString());
        console.log("Anchor:", anchorActivation.toISOString());
        console.log("Diff days:", diffMs / MS_PER_DAY);
        console.log("Cycles:", cycles);
        console.log("Planet index:", (cycles + planetOffset) % PLANETS.length);

    // Same format as API
    return {
        activation: currentActivation.toISOString(),
        expiry: currentExpiry.toISOString(),
        location,
    };
}



// declare function to get data from api
var debugging_mode = false
var dataSaved = false
var traderData
var rawApiData
var apiRequestNumber = 0
var apiRequestNumberLimit = 3
var callingApi = 0
const WORLDSTATE_API = "https://api.warframe.com/cdn/worldState.php";
var offlineRetryInterval = 0;        // interval id for periodic attempts while offline
const OFFLINE_RETRY_MS = 20 * 60 * 1000; // 5 minutes between retries (adjustable)
let offlineRetryLoop = null;

function updateTraderData(force_update = false) {
    if (debugging_mode) {
        traderData = {
            "activation": "2022-02-05T23:00:00.000Z",
            "expiry": "2023-01-30T21:31:00.000Z",
            'location': 'Larunda Relay (Mercury)'
        }
        //Insert new data for testing purposes
        if (dateInPast(isoToObj(traderData["expiry"]))) {
            traderData = {
                "activation": "2022-10-28T21:12:00.000Z",
                "expiry": "2022-11-28T21:20:00.000Z",
                'location': 'Strata Relay (Earth)'
            }
        }
    }
    else {
        if (force_update) {
            callAPI()
        }
        else {
            let loadedData = localStorage.getItem("savedTraderData")
            if (loadedData + "" !== "null") {
                loadedData = JSON.parse(loadedData)
                console.log(loadedData["expiry"])
                if (dateInPast(isoToObj(loadedData["expiry"]))) {
                    // load new data bc the saved data is expired
                    callAPI()
                }
                else {
                    // load data from local storage
                    traderData = loadedData
                    dataSaved = true
                }
            }
            else {
                // load new data bc there is no data saved 
                callAPI()
            }
        }
    }
}


function callAPI() {
    if (callingApi === 0) {
        apiRequestNumber = 0; // reset attempt counter when we start trying
        callingApi = setInterval(APIRequest, 5000);
        // Also perform one immediate attempt right away so user doesn't wait 5s
        APIRequest();
    }
}

async function APIRequest() {
    apiRequestNumber = apiRequestNumber + 1;

    // AbortController + timeout to avoid stuck requests
    const controller = new AbortController();
    const timeoutMs = 4000; // adjust timeout as needed
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const resp = await fetch(WORLDSTATE_API, { signal: controller.signal });

        clearTimeout(timeoutId);

        if (!resp.ok) {
            console.warn('API returned non-OK status', resp.status);
            throw new Error('HTTP ' + resp.status);
        }

        const data = await resp.json();

        // Parse VoidTrader data from new API
        const traders = data["VoidTraders"];
        if (traders && traders.length > 0) {
            const trader = traders[0];
            const activation = new Date(parseInt(trader.Activation.$date.$numberLong)).toISOString();
            const expiry = new Date(parseInt(trader.Expiry.$date.$numberLong)).toISOString();

            traderData = {
                activation: activation,
                expiry: expiry,
                location: trader.Node || "Unknown Relay"
            };
            rawApiData = traderData;
        } else {
            traderData = undefined;
        }

        // Stop retrying once we have valid data
        if (callingApi !== 0) {
            clearInterval(callingApi);
            callingApi = 0;
        }

        apiRequestNumber = 0; // reset attempts on success
        localStorage.setItem("isOfflineTime", false);

        // stop periodic offline retry if running
        if (offlineRetryInterval !== 0) {
            clearInterval(offlineRetryInterval);
            offlineRetryInterval = 0;
            console.info("Offline retry loop cleared — API recovered.");
        }

        return;
    } catch (err) {
        clearTimeout(timeoutId);
        console.warn('APIRequest failed (attempt ' + apiRequestNumber + '):', err);

        // If we've reached the allowed number of attempts, stop retrying
        if (apiRequestNumber >= apiRequestNumberLimit) {
            if (callingApi !== 0) {
                clearInterval(callingApi);
                callingApi = 0;
            }
            // Show internet warning immediately:
            internetWarningEL.style.opacity = "1"
            if (typeof traderData === "undefined") {
                traderData = calculateScheduleOffline("2023-02-12T13:00:00Z", 3);
                localStorage.setItem("isOfflineTime", true);
                startOfflineRetryLoop(OFFLINE_RETRY_MS)
            }
        }
        // otherwise we'll just let the interval fire again later
    }
}


function startOfflineRetryLoop(interval) {
    // Avoid duplicates
    if (offlineRetryLoop !== null) return;

    console.log("Starting offline retry loop...");
    offlineRetryLoop = setInterval(async () => {
        console.log("Retrying API connection...");
        await APIRequest();

        // If we successfully get API data, stop retrying
        if (localStorage.getItem("isOfflineTime") === "false") {
            console.log("API reconnected successfully. Stopping retry loop.");
            clearInterval(offlineRetryLoop);
            offlineRetryLoop = null;
        }
    }, interval);
}


// call function to update trader data initially
updateTraderData()
if (localStorage.getItem("isOfflineTime") === "true") {
    startOfflineRetryLoop(OFFLINE_RETRY_MS);
    internetWarningEL.style.opacity = "1"
}

// declare function to check if a date is in the past
function dateInPast (firstDate, secondDate) {
    //if (firstDate.setHours(0, 0, 0, 0) < secondDate.setHours(0, 0, 0, 0)) {
    //    return true;
    //}
    //return false;
    
    // shitty workaround here:
    let timeTxt = timeToGo(firstDate, false, "poe", true, 0, false, true) + ""
    if (timeTxt.slice(0,1) == "-") {
        return true;
    }
    return false
};

// convert time string to time object
function isoToObj(s, daysToAdd = 0) {
    var b = s.split(/[-TZ:]/i);
    let date_ = new Date(Date.UTC(b[0], --b[1], b[2], b[3], b[4], b[5]));
    if (daysToAdd > 0) {
        date_.setDate(date_.getDate() + daysToAdd)
    }
    return date_
}

// declare time variables
var hours
var mins
var secs
var days

// Utility to add leading zero
function z(n) {
    return (n < 10? '0' : '') + n;
}

// calculate time string
function timeToGo(s, returnOBJ = false, resultFormatting = "poe", showSeconds = true, daysToAdd = 0, isCountdown = false, isInputDateObject = false) {

    // Convert string to date object
    if (isInputDateObject) {
        var d = s
    }
    else {
        // @ts-ignore
        var d = isoToObj(s);
    }
    // @ts-ignore
    var diff = d.getTime() - Date.now();

    // Allow for previous times
    var sign = diff < 0? '-' : '';
    diff = Math.abs(diff);

    // Get time components
    var hours = diff/3.6e6 | 0;
    var mins  = diff%3.6e6 / 6e4 | 0;
    var secs  = Math.round(diff%6e4 / 1e3);

    // calculate days
    var days = Math.floor(hours/24)

    if(days > 0) {
        hours = hours - (24 * days)
    }

    // check if there are 60 seconds and replace it bc it looks nicer
    if(secs == 60) {
        secs = 0
        mins = mins + 1
    }

    if(returnOBJ) {
        var time = {
            "days": days,
            "hours": hours,
            "mins": mins,
            "secs": secs
        }
        return time
    }
    else {
        // Return formatted string
        if(days > 0) {
            if (resultFormatting == "poe") {
                if (showSeconds) {
                    return sign + days + 'd ' + z(hours) + 'h ' + z(mins) + 'm ' + z(secs) + "s";
                }
                else {
                    return sign + days + 'd ' + z(hours) + 'h ' + z(mins) + 'm';
                }
            }
            else if (resultFormatting == "clock") {
                if (showSeconds) {
                    return sign + z(days) + ':' + z(hours) + ':' + z(mins) + ':' + z(secs);
                }
                else {
                    return sign + z(days) + ':' + z(hours) + ':' + z(mins) + ':' + z(secs);
                }
            }
        }
        else {
            if (resultFormatting == "poe") {
                if (showSeconds) {
                    return sign + z(hours) + 'h ' + z(mins) + 'm ' + z(secs) + "s";
                }
                else {
                    if (days == 0 && hours == 0 && mins == 0) {
                        return "0h <1m"
                    }
                    else {
                        return sign + z(hours) + 'h ' + z(mins) + 'm';
                    }
                }
            }
            else if (resultFormatting == "clock") {
                if (showSeconds) {
                    return sign + z(hours) + ':' + z(mins) + ':' + z(secs);   
                }
                else {
                    if (days == 0 && hours == 0 && mins == 0) {
                        return "00:<01"
                    }
                    else {
                        return sign + z(hours) + ':' + z(mins);
                    }
                }
            }
        }
    }
}

function getPlanetImage(planetString) {
    //if(typeof target_planet == "undefined" || target_planet == planets["unknown"])  {
    let selectedPlanet
    if(planetString.includes("Mercury")) {
        selectedPlanet = planets["mercury"]
    }
    else if(planetString.includes("Venus")) {
        selectedPlanet = planets["venus"]
    }
    else if(planetString.includes("Earth")) {
        selectedPlanet = planets["earth"]
    }
    else if(planetString.includes("Saturn")) {
        selectedPlanet = planets["saturn"]
    }
    else if(planetString.includes("Europa")) {
        selectedPlanet = planets["europa"]
    }
    else if(planetString.includes("Eris")) {
        selectedPlanet = planets["eris"]
    }
    else if(planetString.includes("Pluto")) {
        selectedPlanet = planets["pluto"]
    }
    else {
        selectedPlanet = planets["unknown"]
    }
    return selectedPlanet
}

// main function
setInterval(updateCountdown, 1000);
function updateCountdown(){
    // check if new data has been loaded
    if(typeof rawApiData !== "undefined") {
        clearInterval(callingApi)
        callingApi = 0
        traderData = rawApiData
        rawApiData = undefined
        dataSaved = false
        apiRequestNumber = 0
        internetWarningEL.style.opacity = "0"
    }

    var isOfflineTime = localStorage.getItem("isOfflineTime")
    if (typeof isOfflineTime !== "undefined" && isOfflineTime == true) {
        //show internet warning
        internetWarningEL.style.opacity = "1"
        
    }

    // calculate offline timer
    if(typeof traderData !== "undefined"){
        // update countdown timer
        if(dateInPast(isoToObj(traderData["activation"]), new Date())) {
            if(dateInPast(isoToObj(traderData["expiry"]), new Date())) {
                // do if baro has already left, new data needs to be loaded from the api
                //og_timeEL.innerHTML = "";
                if (apiRequestNumber >= apiRequestNumberLimit) {
                    
                }
                else {
                    countdownEl.innerHTML = "";
                    baro_timer_textEL.innerHTML = "Retrieving Baro's Schedule";
                    // update data
                    updateTraderData()
                }
                
            }
            else {
                // do if baro already arrive but hasnt left yet
                //og_timeEL.innerHTML = isoToObj(traderData["expiry"]);
                countdownEl.innerHTML = "" + timeToGo(traderData["expiry"], false, baro_countdown_formatting, baro_countdown_show_seconds);
                baro_timer_textEL.innerHTML = "Baro will leave in";

                var currentTimeObj = timeToGo(traderData["expiry"], true, baro_countdown_formatting, baro_countdown_show_seconds);
                if (dataSaved == false && currentTimeObj["secs"] > 5) {
                    dataSaved = true
                    localStorage.setItem("savedTraderData", JSON.stringify(traderData));
                    localStorage.setItem("savedLastTarget", JSON.stringify(traderData["location"]));
                }
            }
        }
        else { 
            // do if baro hasnt arived yet
            //og_timeEL.innerHTML = isoToObj(traderData["activation"]);
            countdownEl.innerHTML = "" + timeToGo(traderData["activation"], false, baro_countdown_formatting, baro_countdown_show_seconds);
            baro_timer_textEL.innerHTML = "Baro will return in";
            
            // save data in local storage
            if (dataSaved == false) {
                dataSaved = true
                localStorage.setItem("savedTraderData", JSON.stringify(traderData));
                // cant save last target planet bc this event will also be called after baro has already left and thus would overwrite the savedata with the new target planet
            }
        }
    }
    else {
        //countdownEl.innerHTML = "" + apiRequestNumber;
        if (countdownEl.textContent == "Loading") {
            countdownEl.innerHTML = "Loading."
        }
        else if (countdownEl.textContent == "Loading.") {
            countdownEl.innerHTML = "Loading.."
        }
        else if (countdownEl.textContent == "Loading..") {
            countdownEl.innerHTML = "Loading..."
        }
        else {
            countdownEl.innerHTML = "Loading"
        }
        
    }

    // update clock
    let currentdate = new Date();
    if (time_formatting == "poe") {
        if (time_show_seconds) {
            timeEL.innerHTML = z(currentdate.getHours()) + "h " + z(currentdate.getMinutes()) + "m " + z(currentdate.getSeconds()) + "s"
        }
        else {
            timeEL.innerHTML = z(currentdate.getHours()) + "h " + z(currentdate.getMinutes()) + "m"
        }
    }
    else if (time_formatting == "clock") {
        if (time_show_seconds) {
            timeEL.innerHTML = z(currentdate.getHours()) + ":" + z(currentdate.getMinutes()) + ":" + z(currentdate.getSeconds())
        }
        else {
            timeEL.innerHTML = z(currentdate.getHours()) + ":" + z(currentdate.getMinutes())
        }
    }
    else if (time_formatting == "poe_pm") {
        if (time_show_seconds) {
            if (currentdate.getHours() > 12) {
                timeEL.innerHTML = z(currentdate.getHours() - 12) + "h " + z(currentdate.getMinutes()) + "m " + z(currentdate.getSeconds()) + "s PM"
            }
            else {
                timeEL.innerHTML = z(currentdate.getHours()) + "h " + z(currentdate.getMinutes()) + "m " + z(currentdate.getSeconds()) + "s AM"
            }
        }
        else {
            if (currentdate.getHours() > 12) {
                timeEL.innerHTML = z(currentdate.getHours() - 12) + "h " + z(currentdate.getMinutes()) + "m PM"
            }
            else {
                timeEL.innerHTML = z(currentdate.getHours()) + "h " + z(currentdate.getMinutes()) + "m AM"
            }
        }
    }
    else if (time_formatting == "clock_pm") {
        if (time_show_seconds) {
            if (currentdate.getHours() > 12) {
                timeEL.innerHTML = z(currentdate.getHours()-12) + ":" + z(currentdate.getMinutes()) + ":" + z(currentdate.getSeconds()) + " PM"
            }
            else {
                timeEL.innerHTML = z(currentdate.getHours()) + ":" + z(currentdate.getMinutes()) + ":" + z(currentdate.getSeconds()) + " AM"
            }
        }
        else {
            if (currentdate.getHours() > 12) {
                timeEL.innerHTML = z(currentdate.getHours() - 12) + ":" + z(currentdate.getMinutes()) + " PM"
            }
            else {
                timeEL.innerHTML = z(currentdate.getHours()) + ":" + z(currentdate.getMinutes()) + " AM"
            }
        }
    }

    // update bg image
    let imgRotStep = 360 / 86400
    let imgRot = 360 - (imgRotStep * (currentdate.getSeconds() + (currentdate.getMinutes() * 60) + (currentdate.getHours() * 60 * 60)))
    timer_imageEL.style.transform = `rotate(${imgRot}deg)`;
}


// update baro animation
setInterval(updateBaro, 50);
function updateBaro() {
    if(typeof traderData !== "undefined"){
        if (enable_baro_animation) {
            let isActive = traderData["active"]
            let arrivalTime = timeToGo(traderData["activation"], true, "poa", true)
            
            let planetImageSet = false

            // set values for the animtion
            let baros_ship_right_image = "images/baros_ship_right.png"
            let baros_ship_left_image = "images/baros_ship_left.png"


            let movSpd = 5
            let opSpd =  0.05
            
            let ToTargPlanetAnimRemDays = 1
            let ToVoidAnimDays = 11
            let maxDays = 12

            //anchor points in px
            let baroShipStartPos = 130
            let baroShipEndPos = 1050
            let shipTravelDist = baroShipEndPos - baroShipStartPos

            let targetPlanetMiddlePos = 550
            let VoidMiddlePos = 550

            let targetPlanetPos = Number(target_planet_imageEL.style.right.slice(0, -2))
            let voidPos = Number(void_imageEL.style.left.slice(0, -2))

            //target_planet_imageEL.style.right = targetPlanetMiddlePos +"px"

            if(dateInPast(isoToObj(traderData["activation"]), new Date())) {
                if(dateInPast(isoToObj(traderData["expiry"]), new Date())) {
                    //if baro has already left // New data gets loaded from the API
                }
                else {
                    // execute if baro has arrived
                    // move target planet to the middle
                    if (targetPlanetPos < targetPlanetMiddlePos) {
                        target_planet_imageEL.style.right = targetPlanetPos + movSpd + "px"
                    }

                    // hide void, ship and the white bar
                    let imgOp = Number(window.getComputedStyle(void_imageEL).getPropertyValue("opacity"))
                    if (imgOp > 0) {
                        void_imageEL.style.opacity = "" + (imgOp - opSpd)
                        white_line_imageEL.style.opacity = "" + (imgOp - opSpd)
                        baros_shipEL.style.opacity = "" + (imgOp - opSpd)
                    }
                    // make sure the target planet is visible
                    target_planet_imageEL.style.opacity = "" + 1
                }
            }
            else {
                // baro hasnt arrived yet                                                     // < - - - - - FIXED (Void Movement Testen)
                if(arrivalTime["days"] < ToTargPlanetAnimRemDays) {
                    // if baro is almost there
                    // move void to the left
                    if (voidPos > 0) {
                        void_imageEL.style.left = voidPos - movSpd + "px"
                    }
                    // move target planet to the right
                    if (targetPlanetPos > 0) {
                        target_planet_imageEL.style.right = targetPlanetPos - movSpd + "px"
                    }
                    // show target planet, void, ship and white bar
                    let imgOp = Number(window.getComputedStyle(target_planet_imageEL).getPropertyValue("opacity"))
                    if (imgOp < 1) {
                        target_planet_imageEL.style.opacity = "" + (imgOp + opSpd)
                        void_imageEL.style.opacity = "" + (imgOp + opSpd)
                        white_line_imageEL.style.opacity = "" + (imgOp + opSpd)
                        baros_shipEL.style.opacity = "" + (imgOp + opSpd)
                    }

                    // select right landing ship
                    // @ts-ignore
                    baros_shipEL.src = baros_ship_right_image

                    // Landing ship animation
                    // calculate distance per second
                    let maxSecs = (((ToTargPlanetAnimRemDays*24)*60)*60)
                    let shipSteps = shipTravelDist / maxSecs
                    // calculate current seconds
                    let currentSecs = arrivalTime["secs"] + (arrivalTime["mins"]*60) + ((arrivalTime["hours"]*60)*60) + (((arrivalTime["days"]*24)*60)*60)
                    let currentPos = maxSecs - currentSecs
                    // update ship position
                    baros_shipEL.style.left = (currentPos * shipSteps) + "px"

                    // set planet image to last target planet
                    // @ts-ignore
                    target_planet_imageEL.src = getPlanetImage(traderData["location"])
                    planetImageSet = true
                    
                    
                }
                else if(arrivalTime["days"] >= ToVoidAnimDays) {
                    // if baro started a few hours/days ago                         // < - - - - - FIXED
                    // move void to the left
                    if (voidPos > 0) {
                        void_imageEL.style.left = voidPos - movSpd + "px"
                    }
                    // move target planet to the right
                    if (targetPlanetPos > 0) {
                        target_planet_imageEL.style.right = targetPlanetPos - movSpd + "px"
                    }
                    // show target planet, void, ship and white bar
                    let imgOp = Number(window.getComputedStyle(void_imageEL).getPropertyValue("opacity"))
                    if (imgOp < 1) {
                        void_imageEL.style.opacity = "" + (imgOp + opSpd)
                        white_line_imageEL.style.opacity = "" + (imgOp + opSpd)
                        baros_shipEL.style.opacity = "" + (imgOp + opSpd)
                        target_planet_imageEL.style.opacity = "" + 1
                    }

                    // selet left landing ship
                    // @ts-ignore
                    baros_shipEL.src = baros_ship_left_image

                    // animation to fly to the void
                    let maxSecs = ((((maxDays-ToVoidAnimDays)*24)*60)*60)
                    let shipSteps = shipTravelDist / maxSecs
                    let currentSecs = arrivalTime["secs"] + (arrivalTime["mins"]*60) + ((arrivalTime["hours"]*60)*60) // (((arrivalTime["days"]*24)*60)*60) <-- not needed atm bc travel time is less than a day
                    // update ship position
                    baros_shipEL.style.left = (shipSteps * currentSecs) + "px"

                    // select correct planet image
                    // load the old target planet so it can be displayed correctly
                    last_target_planet = JSON.parse(localStorage.getItem("savedLastTarget"))
                    target_planet_imageEL.src = getPlanetImage(last_target_planet) 
                    planetImageSet = true

                }
                else {
                    // if baro arrrived in the void
                    // move void to the middle
                    if (voidPos < VoidMiddlePos) {
                        void_imageEL.style.left = voidPos + movSpd + "px"
                    }
                    // hide target planet, ship and the white bar
                    let imgOp = Number(window.getComputedStyle(target_planet_imageEL).getPropertyValue("opacity"))
                    if (imgOp > 0) {
                        target_planet_imageEL.style.opacity = "" + (imgOp - opSpd)
                        white_line_imageEL.style.opacity = "" + (imgOp - opSpd)
                        baros_shipEL.style.opacity = "" + (imgOp - opSpd)
                    }
                    // make sure the void is visible
                    void_imageEL.style.opacity = "" + 1
                }
            }

            // set plante image if it hasnt been set yet
            if (planetImageSet == false) {
                // @ts-ignore
                target_planet_imageEL.src = getPlanetImage(traderData["location"])
            }
        }
        else{
            target_planet_imageEL.style.opacity = "" + 0
            white_line_imageEL.style.opacity = "" + 0
            baros_shipEL.style.opacity = "" + 0
            void_imageEL.style.opacity = "" + 0
        }
    }
}

// declare wallpaper property listener (this is the part for the customization via Wallpaper Engine)
// @ts-ignore
window.wallpaperPropertyListener = {
    applyUserProperties: function (properties) {
        // website scale
        if (properties.scale) {
            // @ts-ignore
            document.body.style.zoom = properties.scale.value;
        }
        // top space
        if (properties.topspace) {
            topSpaceEL.style.height = properties.topspace.value + "px";
        }
        // time formatting
        if (properties.time_formatting) {
            time_formatting = properties.time_formatting.value
            // overwrite clock to make changes happen instantly
            let currentdate = new Date();
            if (time_formatting == "poe") {
                if (time_show_seconds) {
                    timeEL.innerHTML = z(currentdate.getHours()) + "h " + z(currentdate.getMinutes()) + "m " + z(currentdate.getSeconds()) + "s"
                }
                else {
                    timeEL.innerHTML = z(currentdate.getHours()) + "h " + z(currentdate.getMinutes()) + "m"
                }
            }
            else if (time_formatting == "clock") {
                if (time_show_seconds) {
                    timeEL.innerHTML = z(currentdate.getHours()) + ":" + z(currentdate.getMinutes()) + ":" + z(currentdate.getSeconds())
                }
                else {
                    timeEL.innerHTML = z(currentdate.getHours()) + ":" + z(currentdate.getMinutes())
                }
            }
            else if (time_formatting == "poe_pm") {
                if (time_show_seconds) {
                    if (currentdate.getHours() > 12) {
                        timeEL.innerHTML = z(currentdate.getHours() - 12) + "h " + z(currentdate.getMinutes()) + "m " + z(currentdate.getSeconds()) + "s PM"
                    }
                    else {
                        timeEL.innerHTML = z(currentdate.getHours()) + "h " + z(currentdate.getMinutes()) + "m " + z(currentdate.getSeconds()) + "s AM"
                    }
                }
                else {
                    if (currentdate.getHours() > 12) {
                        timeEL.innerHTML = z(currentdate.getHours() - 12) + "h " + z(currentdate.getMinutes()) + "m PM"
                    }
                    else {
                        timeEL.innerHTML = z(currentdate.getHours()) + "h " + z(currentdate.getMinutes()) + "m AM"
                    }
                }
            }
            else if (time_formatting == "clock_pm") {
                if (time_show_seconds) {
                    if (currentdate.getHours() > 12) {
                        timeEL.innerHTML = z(currentdate.getHours() - 12) + ":" + z(currentdate.getMinutes()) + ":" + z(currentdate.getSeconds()) + " PM"
                    }
                    else {
                        timeEL.innerHTML = z(currentdate.getHours()) + ":" + z(currentdate.getMinutes()) + ":" + z(currentdate.getSeconds()) + " AM"
                    }
                }
                else {
                    if (currentdate.getHours() > 12) {
                        timeEL.innerHTML = z(currentdate.getHours() - 12) + ":" + z(currentdate.getMinutes()) + " PM"
                    }
                    else {
                        timeEL.innerHTML = z(currentdate.getHours()) + ":" + z(currentdate.getMinutes()) + " AM"
                    }
                }
            }
        }
        // time show seconds
        if (properties.time_show_seconds) {
            time_show_seconds = properties.time_show_seconds.value
            // overwrite clock to make changes happen instantly
            let currentdate = new Date();
            if (time_formatting == "poe") {
                if (time_show_seconds) {
                    timeEL.innerHTML = z(currentdate.getHours()) + "h " + z(currentdate.getMinutes()) + "m " + z(currentdate.getSeconds()) + "s"
                }
                else {
                    timeEL.innerHTML = z(currentdate.getHours()) + "h " + z(currentdate.getMinutes()) + "m"
                }
            }
            else if (time_formatting == "clock") {
                if (time_show_seconds) {
                    timeEL.innerHTML = z(currentdate.getHours()) + ":" + z(currentdate.getMinutes()) + ":" + z(currentdate.getSeconds())
                }
                else {
                    timeEL.innerHTML = z(currentdate.getHours()) + ":" + z(currentdate.getMinutes())
                }
            }
            else if (time_formatting == "poe_pm") {
                if (time_show_seconds) {
                    if (currentdate.getHours() > 12) {
                        timeEL.innerHTML = z(currentdate.getHours() - 12) + "h " + z(currentdate.getMinutes()) + "m " + z(currentdate.getSeconds()) + "s PM"
                    }
                    else {
                        timeEL.innerHTML = z(currentdate.getHours()) + "h " + z(currentdate.getMinutes()) + "m " + z(currentdate.getSeconds()) + "s AM"
                    }
                }
                else {
                    if (currentdate.getHours() > 12) {
                        timeEL.innerHTML = z(currentdate.getHours() - 12) + "h " + z(currentdate.getMinutes()) + "m PM"
                    }
                    else {
                        timeEL.innerHTML = z(currentdate.getHours()) + "h " + z(currentdate.getMinutes()) + "m AM"
                    }
                }
            }
            else if (time_formatting == "clock_pm") {
                if (time_show_seconds) {
                    if (currentdate.getHours() > 12) {
                        timeEL.innerHTML = z(currentdate.getHours() - 12) + ":" + z(currentdate.getMinutes()) + ":" + z(currentdate.getSeconds()) + " PM"
                    }
                    else {
                        timeEL.innerHTML = z(currentdate.getHours()) + ":" + z(currentdate.getMinutes()) + ":" + z(currentdate.getSeconds()) + " AM"
                    }
                }
                else {
                    if (currentdate.getHours() > 12) {
                        timeEL.innerHTML = z(currentdate.getHours() - 12) + ":" + z(currentdate.getMinutes()) + " PM"
                    }
                    else {
                        timeEL.innerHTML = z(currentdate.getHours()) + ":" + z(currentdate.getMinutes()) + " AM"
                    }
                }
            }
        }
        // countdown formatting
        if (properties.baro_countdown_formatting) {
            baro_countdown_formatting = properties.baro_countdown_formatting.value
            // overwrite countdown to make changes happen instantly
            if (typeof traderData !== "undefined") {
                // update countdown timer
                if (dateInPast(isoToObj(traderData["activation"]), new Date())) {
                    if (dateInPast(isoToObj(traderData["expiry"]), new Date())) {
                        // do nothing
                    }
                    else {
                        countdownEl.innerHTML = "" + timeToGo(traderData["expiry"], false, baro_countdown_formatting, baro_countdown_show_seconds);
                    }
                }
                else {
                    countdownEl.innerHTML = "" + timeToGo(traderData["activation"], false, baro_countdown_formatting, baro_countdown_show_seconds);
                }
            }
        }
        // countdown show seconds
        if (properties.baro_countdown_show_seconds) {
            baro_countdown_show_seconds = properties.baro_countdown_show_seconds.value
            // overwrite countdown to make changes happen instantly
            if (typeof traderData !== "undefined") {
                // update countdown timer
                if (dateInPast(isoToObj(traderData["activation"]), new Date())) {
                    if (dateInPast(isoToObj(traderData["expiry"]), new Date())) {
                        // do nothing
                    }
                    else {
                        countdownEl.innerHTML = "" + timeToGo(traderData["expiry"], false, baro_countdown_formatting, baro_countdown_show_seconds);
                    }
                }
                else {
                    countdownEl.innerHTML = "" + timeToGo(traderData["activation"], false, baro_countdown_formatting, baro_countdown_show_seconds);
                }
            }
        }
        // enable / show baro countdown
        if (properties.enable_baro_countdown) {
            if (properties.enable_baro_countdown.value) {
                countdownEl.style.opacity = "" + 1
                baro_timer_textEL.style.opacity = "" + 1
            }
            else {
                countdownEl.style.opacity = "" + 0
                baro_timer_textEL.style.opacity = "" + 0
                //countdownEl.style.height = 0 // nochmal was besseres hierfür überlegen
                //baro_timer_textEL.style.height = 0
            }
        }
        // show connection Warning
        if (properties.baro_countdown_show_connection_warning) {
            if (properties.baro_countdown_show_connection_warning.value) {
                internetWarningParentEL.style.opacity = "1"
            } else {
                internetWarningParentEL.style.opacity = "0"
            }
        }
        // enable baro animation
        if (properties.enable_baro_animation) {
            enable_baro_animation = properties.enable_baro_animation.value
        }
        // appy clock font
        if (properties.clockfont) {
            timeEL.style.fontFamily = properties.clockfont.value
        }
        // appy baro text font
        if (properties.barofont) {
            baro_timer_textEL.style.fontFamily = properties.barofont.value
        }
        // appy baro timer font
        if (properties.barotimerfont) {
            countdownEl.style.fontFamily = properties.barotimerfont.value
        }
        //clear local storage & reload page
        if (properties.clear_local_storage) {
            let last_state = localStorage.getItem("clearLocalStorageState")
            if (properties.clear_local_storage.value == true) {
                if (last_state != "true") {
                    localStorage.clear();
                    localStorage.setItem("clearLocalStorageState", "true")
                    window.location.reload();
                }
            }
            else if (properties.clear_local_storage.value == false) {
                localStorage.setItem("clearLocalStorageState", "false")
            }
        }
    }
}
