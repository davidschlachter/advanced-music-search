const mm = require('music-metadata')
const Store = require('electron-store')
const store = new Store()

// Get the last folder used on launch
let folder = new String()
let metadata = new Array()
if (store.has("folder")) {
    folder = store.get("folder")
    document.getElementById("last").innerHTML = "Last loaded " + folder
    getMetadata(folder)
    makeTable(metadata)
    console.log(metadata)
    document.getElementById("last").innerHTML = "Loaded " + folder
}

document.addEventListener('drop', function (e) {
    e.preventDefault()
    e.stopPropagation()
    for (let f of e.dataTransfer.files) {
        let folder = f.path
        store.set("folder", folder)
	    getMetadata(folder)
        document.getElementById("last").innerHTML = "Loaded " + folder
        makeTable(metadata)
        console.log(metadata)
    }
})
document.addEventListener('dragover', function (e) {
e.preventDefault()
e.stopPropagation()
});

// List all files in a directory in Node.js recursively in a synchronous fashion
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

function getMetadata(dir) {
	let filelist = new Array()
    let data = new Array()
	walkSync(dir, filelist)
}

function parseMetadata(filelist) {
    const audioFile = filelist.shift();
    
    if (audioFile) {
		if (audioFile.includes(".m4a") || audioFile.includes(".mp4")) {
            return mm.parseFile(audioFile).then(data => {
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

function makeTable(metadata) {
    let tbody = ""
    let str = ""
    for (let i = 0; i < metadata.length; i++) {
        str = "<tr><td>" + metadata[i].common.title+"</td><td>" + metadata[i].common.artist + "</td><td>" + metadata[i].common.album + "</td><td>" + metadata[i].common.bpm + "</td></tr>"
        tbody = tbody + str
    }
    document.getElementById("tbody").innerHTML = tbody
}