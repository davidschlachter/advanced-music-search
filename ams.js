const mm = require('music-metadata')
const Store = require('electron-store')
const store = new Store()
const SearchString = require('search-string')

// Get the last folder used on launch
let folder = new String()
let metadata = new Array()
if (store.has("folder")) {
    folder = store.get("folder")
    document.getElementById("last").innerHTML = "Last loaded " + folder
    getMetadata(folder)
    makeTable(metadata)
    document.getElementById("last").innerHTML = "Loaded " + folder
} else {
    document.getElementById("help").innerHTML = "Drop your music folder on to this window to get started"
}


// Run search query on Enter in input box
document.getElementById("search").addEventListener('keydown', function (e) {
    if (e.keyCode == 13) {
        search()
    } else if (e.key === "Escape") {
        document.getElementById("search").value = ""
        makeTable(metadata)
    }
})

// Listener for play/pause
const {ipcRenderer} = require('electron')
ipcRenderer.on('playpauselistener', (event, message) => {
    if (document.getElementById('audiosrc').src === "") return
    if (document.getElementById('audio').paused) {
        document.getElementById('audio').play()
    } else {
        document.getElementById('audio').pause()
    }
})

// Search function
function search() {
    let results = new Array()
    const str = document.getElementById("search").value.toLowerCase()
    const searchString = SearchString.parse(str)
    console.log(searchString)
    let tag = "", query = "", tSearch = "", before = 0, after = 0
    // For each metadata item, check if the search query matches
    for (let i = 0; i < metadata.length; i++) {
        // Default state
        metadata[i].remove = false
        before = 0
        after = 0
        // Check key:variable conditions
        for (let j = 0; j < searchString.conditionArray.length; j++) {
            let keyword = searchString.conditionArray[j].keyword
            if (keyword === "before") {
                before = parseInt(searchString.conditionArray[j].value)
                continue
            } else if (keyword === "after") {
                after = parseInt(searchString.conditionArray[j].value)
                continue
            }
            let tag = metadata[i].common[keyword].toLowerCase()
            query = searchString.conditionArray[j].value
            if (tag.includes(query) && searchString.conditionArray[j].negated === true) {
                metadata[i].remove = true
            } else if (!tag.includes(query) && searchString.conditionArray[j].negated === false) {
                metadata[i].remove = true
            }
        }
        // Date searching
        if (before > 0 && metadata[i].common.hasOwnProperty("year")) {
            if (metadata[i].common.year > before)
                metadata[i].remove = true
        }
        if (after > 0 && metadata[i].common.hasOwnProperty("year")) {
            if (metadata[i].common.year < after)
                metadata[i].remove = true
        }
        // Construct the string to match against text queries
        if (metadata[i].common.hasOwnProperty("title"))
            tSearch  = metadata[i].common.title.toString() + " "
        if (metadata[i].common.hasOwnProperty("artist"))
            tSearch += metadata[i].common.artist.toString() + " "
        if (metadata[i].common.hasOwnProperty("album"))
            tSearch += metadata[i].common.album.toString() + " "
        if (metadata[i].common.hasOwnProperty("albumartist"))
            tSearch += metadata[i].common.albumartist.toString() + " "
        tSearch  = tSearch.toLowerCase()
        // Match text queries against common metadata fields
        for (let j = 0; j < searchString.textSegments.length; j++) {
            query = searchString.textSegments[j].text
            if (tSearch.includes(query) && searchString.textSegments[j].negated === true) {
                metadata[i].remove = true
            } else if (!tSearch.includes(query) && searchString.textSegments[j].negated === false) {
                metadata[i].remove = true
            }
        }
    } // done checking metadata items
    
    // Update the table with only matching items
    for (let i = 0; i < metadata.length; i++) {
        if (metadata[i].remove === false) {
            results.push(metadata[i])
        }
    }
    makeTable(results)
}

// Process new folder dropped into window
document.addEventListener('drop', function (e) {
    metadata.length = 0
    document.getElementById("search").value = ""
    e.preventDefault()
    e.stopPropagation()
    for (let f of e.dataTransfer.files) {
        let folder = f.path
        store.set("folder", folder)
	    getMetadata(folder)
        document.getElementById("last").innerHTML = "Loaded " + folder
    }
})
document.addEventListener('dragover', function (e) {
    e.preventDefault()
    e.stopPropagation()
});

// List all files recursively
// https://gist.github.com/kethinov/6658166#gistcomment-1921157
function walkSync (dir, filelist) {
	var path = path || require('path');
	var fs = fs || require('fs'),
		files = fs.readdirSync(dir)
	filelist = filelist || []
	files.forEach(function(file) {
	if (fs.statSync(path.join(dir, file)).isDirectory()) {
		filelist = walkSync(path.join(dir, file), filelist)
	}
	else {
		filelist.push(path.join(dir, file))
	}
	})
    parseMetadata(filelist)
	return filelist
}

// Get metadata parent function
function getMetadata(dir) {
	let filelist = new Array()
    let data = new Array()
	walkSync(dir, filelist)
}

// Run parser on files to get metadata (recursive)
function parseMetadata(filelist) {
    const audioFile = filelist.shift();
    
    if (audioFile) {
		if (audioFile.includes(".m4a") || audioFile.includes(".mp4")) {
            return mm.parseFile(audioFile).then(data => {
                data.path = audioFile
                data.index = metadata.length
                metadata.push(data)
                console.log("Processed: "+data.common.title)
                return parseMetadata(filelist)
            }, reason => {
                console.log(audioFile, reason)
                return parseMetadata(filelist);
            })
		}
    } else {
        makeTable(metadata)
    }
}

// Construct the metadata table
function makeTable(metadata) {
    let tbody = ""
    let str = ""
    for (let i = 0; i < metadata.length; i++) {
        str = "<tr><td class=playbutton id=m" + metadata[i].index + ">▶</td><td>" + metadata[i].common.title+"</td><td>" + metadata[i].common.artist + "</td><td>" + metadata[i].common.album + "</td><td>" + metadata[i].common.bpm + "</td></tr>"
        tbody = tbody + str
    }
    document.getElementById("tbody").innerHTML = tbody
    // Add playback listeners
    let playbuttons = document.getElementsByClassName("playbutton")
    for (let i = 0; i < playbuttons.length; i++) {
        playbuttons[i].addEventListener('click', loadTrack, false)
    }
}

// Load a track to the deck
function loadTrack(e) {
    trackid = parseInt(e.srcElement.id.substring(1))
    document.getElementById('audiosrc').src = metadata[trackid].path
    document.getElementById('audio').load()
    document.getElementById('audio').play()
}