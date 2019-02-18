const mm = require('music-metadata')
const Store = require('electron-store')
const store = new Store()
const SearchString = require('search-string')
const {ipcRenderer} = require('electron')
const path = require('path')
const fs = require('fs')
const MP4Parser = require('mp4parser')
const crypto = require('crypto')


// Get the last folder used on launch
let folder = new String()
let masterTable = new String()
let metadata = new Array()
let oldmetadata = new Array()
if (store.has("masterTable")) {
	console.log("Loading masterTable")
	masterTable = store.get("masterTable")
	showTable(masterTable)
	console.log("Done loading and building masterTable")
}
if (store.has("shuffle")) {
	document.getElementById('shuffle').checked = store.get("shuffle")
}
if (store.has("metadata")) {
	console.log("Loading old metadata")
	metadata = store.get("metadata")
	console.log("Done loading old metadata")
	if (!store.has("masterTable")) makeTable(metadata)
}
if (store.has("folder")) { // Trigger rescan on launch
	folder = store.get("folder")
	getMetadata(folder)
	document.getElementById("last").innerHTML = "Loaded " + folder
} else {
	document.getElementById("help").innerHTML = "Drop your music folder on to this window to get started"
}


// Keyboard shortcuts
document.getElementById("search").addEventListener('keydown', function (e) {
	if (e.keyCode == 13) {
		search()
	} else if (e.key === "Escape") {
		if (document.getElementById("search").value.length === 0)
			document.getElementById("search").blur()
		document.getElementById("search").value = ""
		showTable(masterTable)
	}
})
document.addEventListener('keydown', function (e) {
	if (e.key === "Escape") {
		document.getElementById("search").value = ""
		showTable(masterTable)
	} else if (e.key === "/") {
		window.scrollTo(0,0)
		document.getElementById("search").focus()
		e.preventDefault()
	}
})
ipcRenderer.on('playpauselistener', (event, message) => {
	if (document.getElementById('audiosrc').src === "") {
		loadCurrentTracks()
		return
	}
	if (document.getElementById('audio').paused) {
		document.getElementById('audio').play()
	} else {
		document.getElementById('audio').pause()
	}
})

// Save shuffle button state
document.getElementById("shuffle").addEventListener('click', saveShuffleState, false)
function saveShuffleState() {
	store.set("shuffle", document.getElementById('shuffle').checked)
}
// Next and previous buttons
document.getElementById("next").addEventListener('click', loadCurrentTracks, false)
function playNextTrack() {
	if (!document.getElementById('audio').paused) {
		document.getElementById('audio').currentTime = document.getElementById('audio').duration
	}
}
// Currently playing listener
function showTitle(title) {
	document.getElementById("nowplaying").innerHTML = title
}
// Play currently listed tracks
document.getElementById("playThese").addEventListener('click', loadCurrentTracks, false)
function loadCurrentTracks() {
	let tracks = new Array()
	let playbuttons = document.getElementsByClassName("playbutton")
	for (let i = 0; i < playbuttons.length; i++) {
		let currentID = playbuttons[i].id.substring(1)
		tracks.push(metadata[currentID].hash)
	}
	
	playByHashes(tracks)
}

// Play by hashes
function playByHashes(hashes) {
	if (hashes.length === 0) return
	if (document.getElementById('shuffle').checked) {
		// https://stackoverflow.com/a/12646864/3380815
		for (let i = hashes.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[hashes[i], hashes[j]] = [hashes[j], hashes[i]];
		}
	}
	let hash = hashes.shift()
	let path = ""
	let title = ""
	for (let i=0; i<metadata.length; i++) {
		if (metadata[i].hash === hash) {
			path = metadata[i].path
			title = metadata[i].common.title
		}
	}
	if (path === "") return playByHashes(hashes)
	document.getElementById('audiosrc').src = path
	document.getElementById('audio').load()
	let playPromise = document.getElementById('audio').play()
	showTitle(title)
	playPromise.then(function() {
		document.getElementById('audio').onended = function() {
			return playByHashes(hashes)
		}
	}).catch(function(error) {
		console.log("Playback promise returned error", error)
	})
}

// Search function
function search() {
	let results = new Array()
	const str = document.getElementById("search").value.toLowerCase()
	const searchString = SearchString.parse(str)
	console.log(searchString)
	let tag = "", query = "", tSearch = "", before = 0, after = 0, bpmlow = 0, bpmhigh = 0
	// For each metadata item, check if the search query matches
	for (let i = 0; i < metadata.length; i++) {
		// Default state
		metadata[i].remove = false
		before = 0
		after = 0
		bpmlow = 0
		bpmhigh = 0
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
			if (metadata[i].hasOwnProperty("common") && metadata[i].common.hasOwnProperty(keyword)) {
				tag = metadata[i].common[keyword]
				if (typeof tag === 'string') {
					tag = tag.toLowerCase()
				} else {
					tag = tag.toString()
				}
			}
			query = searchString.conditionArray[j].value
			if (tag.includes(query) && searchString.conditionArray[j].negated === true) {
				metadata[i].remove = true
			} else if (!tag.includes(query) && searchString.conditionArray[j].negated === false) {
				metadata[i].remove = true
			}
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
		tSearch = tSearch.toLowerCase()
		// Alternate before/after synthax and bpm search
		for (let j = 0; j < searchString.textSegments.length; j++) {
			query = searchString.textSegments[j].text
			if (query.includes("<") || query.includes(">")) {
				if (query.includes("year>")) {
					after = parseInt(query.substring(5))
				} else if (query.includes("year<")) {
					before = parseInt(query.substring(5))
				} else if (query.includes("bpm>")) {
					bpmlow = parseInt(query.substring(4))
				} else if (query.includes("bpm<")) {
					bpmhigh = parseInt(query.substring(4))
				}
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
		// BPM search
		if (bpmlow > 0 && metadata[i].common.hasOwnProperty("bpm")) {
			if (metadata[i].common.bpm < bpmlow)
				metadata[i].remove = true
		}
		if (bpmhigh > 0 && metadata[i].common.hasOwnProperty("bpm")) {
			if (metadata[i].common.bpm > bpmhigh)
				metadata[i].remove = true
		}
		// Match text queries against common metadata fields
		for (let j = 0; j < searchString.textSegments.length; j++) {
			query = searchString.textSegments[j].text
			if (query.includes("<") || query.includes(">")) continue
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
})

// Get metadata parent function
function getMetadata(dir) {
	let filelist = new Array()
	let data = new Array()
	
	oldmetadata = JSON.parse(JSON.stringify(metadata))
	metadata.length = 0
	
	console.log("Starting walkSync")
	walkSync(dir, filelist)
}

// List all files recursively
// https://gist.github.com/kethinov/6658166#gistcomment-1921157
function walkSync (dir, filelist) {
	const files = fs.readdirSync(dir)
	filelist = filelist || []
	files.forEach(function(file) {
	if (fs.statSync(path.join(dir, file)).isDirectory()) {
		filelist = walkSync(path.join(dir, file), filelist)
	}
	else {
		filelist.push(path.join(dir, file))
	}
	})
	
	if (store.get("folder") === dir) { // If finishing top-level walkSync
		let newlist = new Array()
		for (let i=0; i<filelist.length;i++) {
			if (filelist[i].includes(".m4a") || filelist[i].includes(".mp4")) {
				newlist.push(filelist[i])
			}
		}
		filelist = newlist
		window.filelist = JSON.parse(JSON.stringify(filelist))
		console.log("Finished walkSync")
		parseMetadata(filelist)
	}
	return filelist
}

// Run parser on files to get metadata (recursive)
function parseMetadata(filelist) {
	const audioFile = filelist.shift()
	
	if (audioFile) {
		let mtime = new Date(fs.statSync(audioFile).mtime)
		
		// Check if already processed
		for (let i=0; i < oldmetadata.length; i++) {
			if (oldmetadata[i].path === audioFile) {
				if (oldmetadata[i].mtime === JSON.parse(JSON.stringify(mtime))) {
					oldmetadata[i].index = metadata.length
					metadata.push(oldmetadata[i])
					return parseMetadata(filelist)
				}
			}
		}
		// Otherwise, 
		return mm.parseFile(audioFile).then(data => {
			data.path = audioFile
			data.index = metadata.length
			if (data.common.hasOwnProperty("picture")) data.common.picture.length = 0
			if (data.hasOwnProperty("format")) data.format.length = 0
			data.mtime = JSON.parse(JSON.stringify(mtime))
			metadata.push(data)
			console.log("New/updated metadata for: "+data.path)
			return parseMetadata(filelist)
		}, reason => {
			data = {}
			data.path = audioFile
			data.index = metadata.length
			data.mtime = JSON.parse(JSON.stringify(mtime))
			data.error = true
			metadata.push(data)
			console.log(audioFile, reason)
			return parseMetadata(filelist)
		})
	} else {
		console.log("Finished updating metadata")
		masterTable = makeTable(metadata)
		store.set("masterTable", masterTable)
		console.log("Now updating hashes")
		// Only get hashes for files from which metadata was sucessfully parsed
		let newFileList = new Array()
		for (let i=0; i<metadata.length; i++) {
			newFileList.push(metadata[i].path)
		}
		filelist = JSON.parse(JSON.stringify(newFileList))
		setHash(filelist)
	}
}

// Calculate SHA1 hashes of mdat stream of each audio file (serves as unique identifier for playlists)
function setHash(filelist) {
	const audioFile = filelist.shift()
	console.log(audioFile)
	if (audioFile && audioFile.hasOwnProperty("error") && audioFile.error) return setHash(filelist)
	try {
		if (audioFile) {
			let mtime = new Date(fs.statSync(audioFile).mtime)
			for (let i=0; i < metadata.length; i++) {
				if (metadata[i].path === audioFile) {
					if (metadata[i].mtime === JSON.parse(JSON.stringify(mtime)) && metadata[i].hasOwnProperty("hash")) {
						return setHash(filelist)
					}
				}
			}
			let stream = fs.createReadStream(audioFile, {start: 0})
			let parser = new MP4Parser.default(stream)
			let hash = crypto.createHash('sha1')
			hash.setEncoding('hex')
			// iTunes encoder stores audio data in mdat atom
			parser.on('data_mdat', chunk => {
				hash.update(chunk)
			})
			// FFMPEG stores audio data in roll atom
			parser.on('data_roll', chunk => {
				hash.update(chunk)
			})
			stream.on('end', () => {
				hash.end()
				hashText = hash.read()
				console.log("New/updated hash for", audioFile, hashText)
				for (let i=0; i < metadata.length; i++) {
					if (metadata[i].path === audioFile) {
						metadata[i].hash = hashText
						// Be ridiculous and save metadata constantly
						store.set("metadata", metadata)
						return setHash(filelist)
					}
					if (i === (metadata.length - 1 )) {
						console.log("Error: file not in metadata", audiofile)
						return setHash(filelist)
					}
				}
			})
			// List all the atoms in the file (for debugging)
			/*parser.on('atom', atom => {
				var seq = "0" + atom._seq
				seq = seq.substring(seq.length - 2, seq.length)
				console.log(`${seq}. |${new Array(atom._level * 3).join('-')}${atom.type}(size:${atom.size}, pos:${atom._pos})`)
			})*/
			parser.start()
		} else {
			console.log("Finished updating hashes")
			store.set("metadata", metadata)
		}
	} catch(error) {
		console.log("Caught an error in setHash", error)
		return setHash(filelist)
	}
	
}

// Construct the metadata table
function makeTable(metadata) {
	let tbody = ""
	let str = ""
	for (let i = 0; i < metadata.length; i++) {
		let index = "", title = "", artist = "", album = "", bpm = ""
		if (metadata[i].hasOwnProperty("index")) index = metadata[i].index
		if (!metadata[i].hasOwnProperty("common")) continue
		if (metadata[i].common.hasOwnProperty("title")) title = metadata[i].common.title
		if (metadata[i].common.hasOwnProperty("artist")) artist = metadata[i].common.artist
		if (metadata[i].common.hasOwnProperty("album")) album = metadata[i].common.album
		if (metadata[i].common.hasOwnProperty("bpm")) bpm = metadata[i].common.bpm
		str = "<tr><td class=playbutton id=m" + index + ">▶</td><td>" + title+"</td><td>" + artist + "</td><td>" + album + "</td><td>" + bpm + "</td></tr>"
		tbody = tbody + str
	}
	showTable(tbody)
	return tbody
}

// Just show a previously generated table
function showTable(tbody) {
	document.getElementById("tbody").innerHTML = tbody
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
	showTitle(metadata[trackid].common.title)
}
