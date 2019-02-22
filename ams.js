const Store = require('electron-store')
const store = new Store()
const SearchString = require('search-string')
const {ipcRenderer} = require('electron')
const path = require('path')
const fs = require('fs')
const MP4Parser = require('mp4parser')
const mp4dashparser = require('mp4-parser')
const crypto = require('crypto')
const recursive = require("recursive-readdir")


// Get the last folder used on launch
let folder = new String()
let metadata = new Array()
let oldmetadata = new Array()
let parsingMetadata = false
let hashingFiles = false
let currentlyShown = {}
if (store.has("shuffle")) {
	document.getElementById('shuffle').checked = store.get("shuffle")
}
if (store.has("metadata")) {
	console.log("Loading old metadata")
	metadata = store.get("metadata")
	console.log("Finished loading old metadata")
}
if (store.has("folder")) { // Trigger rescan on launch
	folder = store.get("folder")
	getMetadata(folder)
	document.getElementById("folder").textContent = folder
} else {
	document.getElementById("firstrun").style.display = "block"
}


// Keyboard shortcuts
document.getElementById("search").addEventListener('keydown', function (e) {
	if (e.keyCode == 13) { // on Enter
		search()
	} else if (e.key === "Escape") {
		if (document.getElementById("search").value.length === 0)
			document.getElementById("search").blur()
		document.getElementById("search").value = ""
		if (currentlyShown.length !== metadata.length) {
			makeTable(metadata)
		}
	} else if (e.key === "?") {
		e.stopPropagation()
	} else if (e.key === "/") {
		e.stopPropagation()
	}
})
document.addEventListener('keydown', function (e) {
	if (e.key === "Escape") {
		if (document.getElementById("help").style.display === "block") {
			document.getElementById("help").style.display = "none"
		} else if (currentlyShown.length === metadata.length) {
			document.getElementById("search").value = ""
		} else {
			document.getElementById("search").value = ""
			makeTable(metadata)
		}
	} else if (e.key === "/") {
		window.scrollTo(0,0)
		document.getElementById("search").focus()
		document.getElementById("search").select()
		e.preventDefault()
	} else if (e.key === "?") {
		if (document.getElementById("help").style.display === "block") {
			document.getElementById("help").style.display = "none"
		} else {
			document.getElementById("help").style.display = "block"
		}
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
ipcRenderer.on('nextlistener', (event, message) => {
	if (document.getElementById('audiosrc').src === "") {
		loadCurrentTracks()
	} else {
		playNextTrack()
	}
	
})

// Save shuffle button state
document.getElementById("shuffle").addEventListener('click', saveShuffleState, false)
function saveShuffleState() {
	store.set("shuffle", document.getElementById('shuffle').checked)
}
// Close shortcuts alert
document.getElementById("closeshortcuts").addEventListener('click', closeShortcuts, false)
function closeShortcuts() {
	document.getElementById("help").style.display = "none"
}
// Next and previous buttons
document.getElementById("next").addEventListener('click', playNextTrack, false)
function playNextTrack() {
	if (document.getElementById('audiosrc').src === "") {
		loadCurrentTracks()
		return
	}
	if (!document.getElementById('audio').paused) {
		document.getElementById('audio').currentTime = document.getElementById('audio').duration
	}
}
// Load stylesheet specific to macOS, which hides scrollbars by default
if (navigator.appVersion.indexOf("Mac") !== -1) {
	console.log("Loaded macOS-specific stylesheet")
	document.getElementsByTagName("head")[0].insertAdjacentHTML("beforeend", "<link rel=\"stylesheet\" href=\"big-table/macos-overflow.css\" />")
}
// Currently playing text
function showTitle(title) {
	document.getElementById("status").textContent = title
}
// Play currently listed tracks
document.getElementById("playThese").addEventListener('click', loadCurrentTracks, false)
function loadCurrentTracks() {
	let tracks = new Array()
	for (let i = 0; i < currentlyShown.length; i++) {
		tracks.push(currentlyShown[i].hash)
	}
	playByHashes(tracks)
}

// Update table (height) on window resize
// https://developer.mozilla.org/en-US/docs/Web/Events/resize#setTimeout
(function() {
	window.addEventListener("resize", resizeThrottler, false)
	var resizeTimeout
	function resizeThrottler() {
		// ignore resize events as long as an actualResizeHandler execution is in the queue
		if ( !resizeTimeout ) {
			resizeTimeout = setTimeout(function() {
				resizeTimeout = null
				actualResizeHandler()
				// The actualResizeHandler will execute at a rate of 3fps
			}, 1000)
		}
	}

	function actualResizeHandler() {
		console.log("Resizing with makeTable")
		if (document.getElementById("listing").style.display === "block") { // only resize if table is visible
			makeTable(currentlyShown)
		}
	}
}())

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
			title = metadata[i].title
		}
	}
	if (path === "") return playByHashes(hashes)
	document.getElementById('audiosrc').src = path
	document.getElementById('audio').load()
	updateNowPlaying(hash)
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

// Update 'now playing'
function updateNowPlaying(hash) {
	window.nowPlaying = hash
	let rows = document.getElementsByClassName('big-table__row')
	for (let i=0; i<rows.length; i++) {
		let item = rows[i]
		let itemhash = item.id.substring(1)
		if (itemhash === hash) {
			item.classList.add("nowplaying")
		} else {
			item.classList.remove("nowplaying")
		}
	}
}

// Search function
function search() {
	let results = new Array()
	const str = document.getElementById("search").value.toLowerCase()
	const searchString = SearchString.parse(str)
	console.log("searchString", searchString)
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
			if (metadata[i].hasOwnProperty(keyword)) {
				tag = metadata[i][keyword]
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
		if (metadata[i].hasOwnProperty("title"))
			tSearch  = metadata[i].title.toString() + " "
		if (metadata[i].hasOwnProperty("artist"))
			tSearch += metadata[i].artist.toString() + " "
		if (metadata[i].hasOwnProperty("album"))
			tSearch += metadata[i].album.toString() + " "
		if (metadata[i].hasOwnProperty("albumartist"))
			tSearch += metadata[i].albumartist.toString() + " "
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
		if (before > 0 && metadata[i].hasOwnProperty("year")) {
			if (metadata[i].year > before)
				metadata[i].remove = true
		}
		if (after > 0 && metadata[i].hasOwnProperty("year")) {
			if (metadata[i].year < after)
				metadata[i].remove = true
		}
		// BPM search
		if (bpmlow > 0 && metadata[i].hasOwnProperty("bpm")) {
			if (metadata[i].bpm < bpmlow)
				metadata[i].remove = true
		}
		if (bpmhigh > 0 && metadata[i].hasOwnProperty("bpm")) {
			if (metadata[i].bpm > bpmhigh)
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
	console.log("Handling the drop")
	dragcounter = 0
	metadata.length = 0
	document.getElementById("firstrun").style.display = "none"
	document.getElementById("dragover").style.display = "none"
	document.getElementById("listing").style.display = "none"
	document.getElementById("search").value = ""
	// Only accept one source directory (for now)
	let folder = e.dataTransfer.files[0].path
	store.set("folder", folder)
	getMetadata(folder)
	document.getElementById("folder").textContent = folder
	e.preventDefault()
	e.stopPropagation()
})
document.addEventListener('dragover', function (e) {
	document.getElementById("dragover").style.display = "block"
	document.getElementById("help").style.display = "none"
	e.preventDefault()
})
document.addEventListener('dragleave', function (e) {
	document.getElementById("dragover").style.display = "none"
	e.preventDefault()
})



// Get metadata parent function
function getMetadata(dir) {
	let filelist = new Array()
	let data = new Array()
	
	oldmetadata = JSON.parse(JSON.stringify(metadata))
	metadata.length = 0
	
	document.getElementById("splash").style.display = "block"
	document.getElementById("xpercent").style.width = "1%"
	document.getElementById("step").textContent = "listing files to scan…"
	recursive(dir, ["*.mp3", "*.jpg", "*.itc"], function (err, filelist) {
		if (err) console.log("Error in recursive:", err)
		if (filelist) {
			let newlist = new Array()
			for (let i=0; i<filelist.length;i++) {
				if (filelist[i].includes(".m4a") || filelist[i].includes(".mp4")) {
					newlist.push(filelist[i])
				}
			}
			window.newlist = JSON.parse(JSON.stringify(newlist))
			window.filelist = JSON.parse(JSON.stringify(newlist))
			if (filelist.length === 0) {
				console.log("Error: no files in filelist. Stopping scan.")
			} else {
				document.getElementById("xpercent").style.width = "5%"
				document.getElementById("step").textContent = "getting metadata…"
				parseMetadata()
			}
		}
	})
}


// Run parser on files to get metadata (recursive)
function parseMetadata() {
	parsingMetadata = true
	const audioFile = window.newlist.shift()
	
	document.getElementById("xpercent").style.width = (5 + ((window.filelist.length-window.newlist.length)/window.filelist.length)*45).toString() + "%"
	
	if (audioFile) {
		let mtime = new Date(fs.statSync(audioFile).mtime)
		
		// Check if already processed
		for (let i=0; i < oldmetadata.length; i++) {
			if (oldmetadata[i].path === audioFile) {
				if (oldmetadata[i].mtime === JSON.parse(JSON.stringify(mtime))) {
					metadata.push(oldmetadata[i])
					return parseMetadata()
				}
			}
		}

		// Otherwise,
		let stream = fs.createReadStream(audioFile)
		let parser = stream.pipe(new mp4dashparser())
		let data = {}
		parser.on('data', function(tag){
			if (tag.type === "aART") {data.albumartist = tag.value}
			if (tag.type === "�ART") {data.artist = tag.value}
			if (tag.type === "�alb") {data.album = tag.value}
			if (tag.type === "�day") {data.year = tag.value}
			if (tag.type === "�nam") {data.title = tag.value}
			if (tag.type === "tmpo") {data.bpm = tag.value}
		})
		parser.on('end', function () {
			data.path = audioFile
			data.mtime = JSON.parse(JSON.stringify(mtime))
			if (!data.hasOwnProperty("title")) data.title = ""
			if (!data.hasOwnProperty("album")) data.album = ""
			if (!data.hasOwnProperty("artist")) data.artist = ""
			if (!data.hasOwnProperty("bpm")) data.bpm = "" // BPM and year shouldn't really be strings
			if (!data.hasOwnProperty("year")) data.year = ""
			if (!data.hasOwnProperty("albumartist")) data.albumartist = ""
			metadata.push(data)
			console.log("metadata.length", metadata.length, "New/updated metadata for:", audioFile)
			return parseMetadata()
		})
	} else {
		document.getElementById("step").textContent = "updating hashes…"
		parsingMetadata = false
		let newFileList = new Array()
		for (let i=0; i<metadata.length; i++) {
			newFileList.push(metadata[i].path)
		}
		//window.filelist = JSON.parse(JSON.stringify(newFileList))
		store.set("metadata", metadata)
		setHash()
	}
}

// Calculate SHA1 hashes of mdat stream of each audio file (serves as unique identifier for playlists)
function setHash() {
	hashingFiles = true
	const audioFile = window.filelist.shift()
	document.getElementById("xpercent").style.width = (50 + ((metadata.length-window.filelist.length)/metadata.length)*45).toString() + "%"
	try {
		if (audioFile) {
			let mtime = new Date(fs.statSync(audioFile).mtime)
			for (let i=0; i < metadata.length; i++) {
				if (metadata[i].path === audioFile) {
					if (metadata[i].mtime === JSON.parse(JSON.stringify(mtime)) && metadata[i].hasOwnProperty("hash")) {
						return setHash()
					}
				}
			}
			let stream = fs.createReadStream(audioFile)
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
				console.log("filelist.length", filelist.length, "New/updated hash for", audioFile, hashText)
				for (let i=0; i < metadata.length; i++) {
					if (metadata[i].path === audioFile) {
						metadata[i].hash = hashText
						return setHash()
					}
					if (i === (metadata.length - 1 )) {
						console.log("Error: file not in metadata", audioFile)
						return setHash()
					}
				}
			})
			stream.on('error', error => {
				console.log("Error in stream:", error)
			})
			// List all the atoms in the file (for debugging)
			/*parser.on('atom', atom => {
				var seq = "0" + atom._seq
				seq = seq.substring(seq.length - 2, seq.length)
				console.log(`${seq}. |${new Array(atom._level * 3).join('-')}${atom.type}(size:${atom.size}, pos:${atom._pos})`)
			})*/
			parser.start()
		} else {
			document.getElementById("step").textContent = "making table…"
			document.getElementById("splash").style.display = "none"
			makeTable(metadata)
			document.getElementById("search").disabled = false
			console.log("Finished updating hashes, metadata is now:", metadata)
			hashingFiles = false
			store.set("metadata", metadata)
		}
	} catch(error) {
		console.log("Caught an error in setHash", error)
		return setHash()
	}
	
}

// Construct the metadata table
function makeTable(data) {
	document.getElementById("listing").style.display = "block"
	let table = new BigTable({
		container: '#listing',
		data: data,
		height: (window.innerHeight-(96+80+9.6+9.6))-23, // Somehow always 76px more than specified
		itemHeight: 20,
		columns: [
			{
				title: "Title",
				type: String,
				key: "title",
				css: {'big-table__col-3': true}
			},
			{
				title: "Artist",
				type: String,
				key: "artist",
				css: {'big-table__col-4': true}
			},
			{
				title: "Album",
				type: String,
				key: "album",
				css: {'big-table__col-5': true}
			},
			{
				title: "BPM",
				type: Number,
				key: "bpm",
				css: {'big-table__col-6': true}
			}
		]
	})
	currentlyShown = data
}

// Load a track to the deck (used by play buttons)
function loadTrack(e) {
	let trackhash = e.srcElement.id.substring(1)
	let source = "", title = ""
	for (let i=0;i<metadata.length;i++) {
		if (metadata[i].hash === trackhash) {
			source = metadata[i].path
			title = metadata[i].title
			break
		}
	}
	if (source === "") return showTitle("Error: could not load track. No matching hash.")
	document.getElementById('audiosrc').src = source
	document.getElementById('audio').load()
	updateNowPlaying(trackhash)
	document.getElementById('audio').play()
	showTitle(title)
}

// Extremely hacky but seems to be only way to catch buffer boundsError...
process.on('uncaughtException',function(error){
	console.log("uncaughtException global handler got:", error)
	if (parsingMetadata) {
		console.log("Returning to parseMetadata")
		console.log("window.newlist.length", window.newlist.length, "window.newlist[0]", window.newlist[0])
		parseMetadata()
	} else if (hashingFiles) {
		console.log("Returning to setHash")
		console.log("window.filelist.length", window.filelist.length, "window.filelist[0]", window.filelist[0])
		setHash()
	} else {
		console.log("Not in parseMetadata or setHash, nothing to do")
	}
})