"use strict";
var IodineGUI = {
    Iodine: null,
    Blitter: null,
    coreTimerID: null,
    GUITimerID: null,
    toMap: null,
    toMapIndice: 0,
    suspended: false,
    isPlaying: false,
    startTime: (+(new Date()).getTime()),
    mixerInput: null,
    currentSpeed: [false, 0],
    defaults: {
        timerRate: 8,
        sound: true,
        volume: 1,
        skipBoot: true,
        toggleSmoothScaling: true,
        toggleDynamicSpeed: false,
        toggleOffthreadGraphics: true,
        toggleOffthreadCPU: (navigator.userAgent.indexOf("AppleWebKit") == -1 || (navigator.userAgent.indexOf("Windows NT 10.0") != -1 && navigator.userAgent.indexOf("Trident") == -1)),
        keyZonesGBA: [
            // GBA key mapping:
            88, //A (X):
            90, //B (Z):
            32, // Select (SPACE):
            13, // Start (ENTER):
            39, // Right (RIGHT):
            37, // Left (LEFT):
            38, // Up (UP):
            40, // Down (DOWN):
            83, // R (S):
            65  // L (A):
        ],
        keyZonesControl: [
            // Emulator function key mapping:
            55, // Volume Down (7):
            56, // Volume Up (8):
            52, // Speed Up (4):
            51, // Slow Down (3):
            53, // Reset Speed (5):
            54, // Toggle Fullscreen (6):
            80, // Play/pause (P):
            82  // Restart (R):
        ]
    }
};

window.onload = function() {
    window.game = {projectName: "Project", rom: "Project"};

    let img = document.querySelector("img.preview");
    img.setAttribute("src", window.game["rom"] + ".png");

    //Populate settings:
    registerDefaultSettings();
    //Initialize Iodine:
    registerIodineHandler();
    //Initialize the timer:
    calculateTiming();
    //Initialize the graphics:
    registerBlitterHandler();
    //Initialize the audio:
    registerAudioHandler();
    //Register the save handler callbacks:
    registerSaveHandlers();
    //Register the GUI controls.
    registerGUIEvents();
    //Register GUI settings.
    registerGUISettings();
    //Download the BIOS:
    downloadBIOS();
}

function downloadBIOS() {
    downloadFile("gba_bios.bin", registerBIOS);
}

function registerBIOS() {
    processDownload(this, attachBIOS);
    downloadROM();
}

function letErRip(){
    document.querySelector("#container").removeAttribute("class");
    document.getElementById("play").click();
    document.querySelector("img.preview").remove();
}

function downloadROM() {
    downloadFile(game["rom"] + '.gba', registerROM);
}

function registerROM() {
    processDownload(this, attachROM);
    addEvent("click", document.querySelector("img.preview"), letErRip);
}

function registerIodineHandler() {
    try {
        /*
        We utilize SharedArrayBuffer and Atomics API,
        which browsers prior to 2016 do not support:
        */
        if (typeof SharedArrayBuffer != "function" || typeof Atomics != "object") {
            throw null;
        } else if (!IodineGUI.defaults.toggleOffthreadCPU && IodineGUI.defaults.toggleOffthreadGraphics) {
            //Try starting Iodine normally, but initialize offthread gfx:
            IodineGUI.Iodine = new iodineGBAWorkerGfxShim();
        } else if (IodineGUI.defaults.toggleOffthreadGraphics) {
            //Try starting Iodine in a webworker:
            IodineGUI.Iodine = new iodineGBAWorkerShim();
            //In order for save on page unload, this needs to be done:
            addEvent("beforeunload", window, registerBeforeUnloadHandler);
        } else {
            throw null;
        }
    } catch (e) {
        //Otherwise just run on-thread:
        IodineGUI.Iodine = new GameBoyAdvanceEmulator();
    }
}

function registerBeforeUnloadHandler(e) {
    IodineGUI.Iodine.pause();
    if (e.preventDefault) {
        e.preventDefault();
    }
    return "iodineGBA needs to process your save data, leaving now may result in not saving current data.";
}

function initTimer() {
    IodineGUI.Iodine.setIntervalRate(+IodineGUI.defaults.timerRate);
    IodineGUI.coreTimerID = setInterval(function() {
        IodineGUI.Iodine.timerCallback(((+(new Date()).getTime()) - (+IodineGUI.startTime)) >>> 0);
    }, IodineGUI.defaults.timerRate | 0);
}

function calculateTiming() {
    IodineGUI.Iodine.setIntervalRate(+IodineGUI.defaults.timerRate);
}

function startTimer() {
    IodineGUI.coreTimerID = setInterval(function() {
        IodineGUI.Iodine.timerCallback(((+(new Date()).getTime()) - (+IodineGUI.startTime)) >>> 0);
    }, IodineGUI.defaults.timerRate | 0);
}

function updateTimer(newRate) {
    newRate = newRate | 0;
    if ((newRate | 0) != (IodineGUI.defaults.timerRate | 0)) {
        IodineGUI.defaults.timerRate = newRate | 0;
        IodineGUI.Iodine.setIntervalRate(+IodineGUI.defaults.timerRate);
        if (IodineGUI.isPlaying) {
            if (IodineGUI.coreTimerID) {
                clearInterval(IodineGUI.coreTimerID);
            }
            initTimer();
        }
    }
}

function registerBlitterHandler() {
    IodineGUI.Blitter = new GfxGlueCode(240, 160);
    IodineGUI.Blitter.attachCanvas(document.getElementById("emulator_target"));
    IodineGUI.Iodine.attachGraphicsFrameHandler(IodineGUI.Blitter);
    IodineGUI.Blitter.attachGfxPostCallback(function() {
        if (IodineGUI.currentSpeed[0]) {
            var speedDOM = document.getElementById("speed");
            speedDOM.textContent = "Speed: " + IodineGUI.currentSpeed[1] + "%";
        }
    });
}

function registerAudioHandler() {
    var Mixer = new GlueCodeMixer(document.getElementById("play"));
    IodineGUI.mixerInput = new GlueCodeMixerInput(Mixer);
    IodineGUI.Iodine.attachAudioHandler(IodineGUI.mixerInput);
}
