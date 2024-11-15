
// Make an instance of two and place it on the page.
var params = {
fullscreen: true
};
var elem = document.body;
var two = new Two(params).appendTo(elem);

// Two.js has convenient methods to make shapes and insert them into the scene.
var radius = 25;
var x = 0;
var y = 0;
var circle = two.makeCircle(x, y, radius);

radius = 20;
y = -30;
var triangle = two.makePolygon(x, y, radius, 3)

// The object returned has many stylable properties:
circle.fill = '#1188ee';
circle.noStroke();

triangle.fill = '#1188ee';
triangle.noStroke();
triangle.height = 30;

var player = two.makeGroup(circle, triangle)
player.position.set(two.width * 0.5, two.width * 0.5)

// Don’t forget to tell two to draw everything to the screen
two.update();

function move(deltaX, deltaY) {
    if ((deltaX || deltaY)) {
        player.position.set(player.position.x + deltaX, player.position.y + deltaY)
    }
    
    // console.log("redrawing")
    console.log("mouseX:", mouseX, "\nmouseY:", mouseY)
    var angle = Math.atan2(mouseY - player.position.y, mouseX - player.position.x);
    // angle = angle * (180/Math.PI);
    player.rotation = angle + (.5 * Math.PI)
    two.update();
}

function requestMove() {

}


var keysDown = {
    "KeyW": false,
    "KeyA": false,
    "KeyS": false,
    "KeyD": false,
}
onkeydown = onkeyup = (event) => {
    keysDown[event.code] = (event.type == "keydown")
};
var mouseX = 0
var mouseY = 0
onmousemove = (event) => {
    mouseX = event.x
    mouseY = event.y
}

function handleKeys () {
    deltaX = 0
    deltaY = 0
    if (keysDown["KeyW"]) {
        deltaY -= 2
    }
    if (keysDown["KeyA"]) {
        deltaX -= 2
    }
    if (keysDown["KeyS"]) {
        deltaY += 2
    }
    if (keysDown["KeyD"]) {
        deltaX += 2
    }
    move(deltaX, deltaY)
}

function update() {
    handleKeys()
}

setInterval(update, 16)