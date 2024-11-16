const environment = require('./environment')

function roomTemplate1(x, y) {
    template = new environment.RoomTemplate(x, y)
    // Add walls and obstacles here
    return template
}