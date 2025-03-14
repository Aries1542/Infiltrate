const params = {
    fullscreen: true
};
const two = new Two(params); // Base class used for all drawing
two.renderer.domElement.style.background = '#ddd'

const game = {
    gridSize: 10,
}

const main = () => {
    setInterval(update, 15);
    two.play();
};

window.addEventListener("resize", function(){
});

const keysDown = {
    "KeyW": false,
    "KeyA": false,
    "KeyS": false,
    "KeyD": false,
};
onkeydown = onkeyup = (event) => {
    keysDown[event.code] = (event.type === "keydown");
};
onmousemove = (event) => {
    Object.assign(game.mouse, {x: event.x, y: event.y});
};

const update = () => {
};


main();
