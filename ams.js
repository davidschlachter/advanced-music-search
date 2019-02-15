const mm = require('music-metadata')

document.addEventListener('drop', function (e) {
e.preventDefault()
e.stopPropagation()
for (let f of e.dataTransfer.files) {
		let filelist = new Array()
		walkSync(f.path, filelist)
		console.log(filelist)
		for (let i = 0; i < filelist.length; i++) {
			if (filelist[i].includes(".m4a") || filelist[i].includes(".mp4")) {
				mm.parseFile(filelist[i], {native: true})
				  .then( metadata => {
				    console.log(metadata);
				  })
				  .catch( err => {
				    console.error(err.message);
				  });
			}
		}
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