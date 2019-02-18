const { app, BrowserWindow, globalShortcut } = require('electron')

const Store = require('electron-store')
const store = new Store()

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow () {
	let width = 800
	let height = 600
	let x = 0
	let y = 0
	if (store.has("dimensions")) {
		let dimensions = store.get("dimensions")
		width = dimensions.width
		height = dimensions.height
		x = dimensions.x
		y = dimensions.y
	}
	// Create the browser window.
	win = new BrowserWindow({webPreferences: {nodeIntegration: true}, width: width, height: height, x: x, y: y})

	// and load the index.html of the app.
	win.loadFile('index.html')

	// Open the DevTools.
	win.webContents.openDevTools()
		
	// Register shortcuts
	globalShortcut.register('mediaplaypause', () => {
		win.webContents.send('playpauselistener', 'playpause')
	})
	globalShortcut.register('medianexttrack', () => {
		win.webContents.send('nextlistener', 'nexttrack')
	})

	win.on('resize', () => {
		store.set("dimensions", win.getBounds())
	})

	// Emitted when the window is closed.
	win.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		win = null
	})
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

app.on('activate', () => {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (win === null) {
		createWindow()
	}
})

app.on('will-quit', () => {
	// Unregister all shortcuts.
	globalShortcut.unregisterAll()
})