const mm = require('music-metadata')
const Store = require('electron-store')
const store = new Store()

// Get the last folder used on launch
let folder
if (store.has("folder")) {
    let folder = store.get("folder")
    document.getElementById("last").innerHTML = "Last loaded " + folder
    let metadata = getMetadata(folder)
    console.log(metadata)
    document.getElementById("last").innerHTML = "Loaded " + folder
}

document.addEventListener('drop', function (e) {
    e.preventDefault()
    e.stopPropagation()
    for (let f of e.dataTransfer.files) {
        let folder = f.path
        store.set("folder", folder)
	    let metadata = getMetadata(folder)
        document.getElementById("last").innerHTML = "Loaded " + folder
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
	return filelist
}

function getMetadata(dir) {
	let filelist = new Array()
    let data = new Array()
	walkSync(dir, filelist)
	console.log(filelist)
	for (let i = 0; i < filelist.length; i++) {
		if (filelist[i].includes(".m4a") || filelist[i].includes(".mp4")) {
			mm.parseFile(filelist[i], {native: true})
			  .then( metadata => {
			    data.push(metadata)
			  })
			  .catch( err => {
			    console.error(err.message)
			  });
		}
	}
    return data
}