let angle = 0
let x
let z

resetCoords()

document.getElementById("angle-45").addEventListener("click", () => updateCompassAngle(-45))
document.getElementById("angle-5").addEventListener("click", () => updateCompassAngle(-5))
document.getElementById("angle0").addEventListener("click", () => resetCompassAngle())
document.getElementById("angle+5").addEventListener("click", () => updateCompassAngle(5))
document.getElementById("angle+45").addEventListener("click", () => updateCompassAngle(45))

document.getElementById("nw").addEventListener("click", () => updateCoords(-6, -6))
document.getElementById("n").addEventListener("click", () => updateCoords(0, -12))
document.getElementById("ne").addEventListener("click", () => updateCoords(6, -6))
document.getElementById("w").addEventListener("click", () => updateCoords(-12, 0))
document.getElementById("center").addEventListener("click", () => resetCoords())
document.getElementById("e").addEventListener("click", () => updateCoords(12, 0))
document.getElementById("sw").addEventListener("click", () => updateCoords(-6, 6))
document.getElementById("s").addEventListener("click", () => updateCoords(0, 12))
document.getElementById("se").addEventListener("click", () => updateCoords(6, 6))

function resetCompassAngle() {
    updateCompassAngle(-angle)
}

function updateCompassAngle(delta) {
    angle += delta
    document.getElementsByTagName("STYLE").item(0).innerHTML =
        `.pos-angle {transform: rotate(${angle}deg);}\n.neg-angle {transform: rotate(${-angle}deg);}`
}

function resetCoords() {
    x = 57
    z = 279
    displayCoords()
}

function updateCoords(deltaX, deltaZ) {
    x += deltaX
    z += deltaZ
    displayCoords()
}

function displayCoords() {
    document.getElementById("coord-x").innerHTML = x
    document.getElementById("coord-z").innerHTML = z
}

