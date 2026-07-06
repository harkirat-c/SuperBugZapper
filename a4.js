var VSHADER_SOURCE =
  'attribute vec3 position;' +
  'attribute vec3 color;' +
  'uniform mat4 Pmatrix;' +
  'uniform mat4 Vmatrix;' +
  'uniform mat4 Mmatrix;' +
  'varying vec3 vColor;' +
  'void main() {' +
    'gl_Position = Pmatrix * Vmatrix * Mmatrix * vec4(position, 1.0);' +
    'gl_PointSize = 4.0;' +
    'vColor = color;' +
  '}';
 
var FSHADER_SOURCE =
  'precision mediump float;' +
  'varying vec3 vColor;' +
  'void main() {' +
    'gl_FragColor = vec4(vColor, 1.0);' +
  '}';
 
let gl, canvas;
let _P, _V, _M;
let moMatrix = new Matrix4();
 
let isDragging = false;
let lastX = 0, lastY = 0;
let rotX = 20, rotY = 0;
 
let sphereVertBuf, sphereColBuf, sphereIdxBuf, sphereIdxCount;
 
// game state
let bacteria = [];
let maxB = 5;
let gameOver = false;
let playerPts = 0, gamePts = 0;
let threshCount = 0;
let THRESHOLD = 0.35;
let speed = 0.03;
let mouseX = 0, mouseY = 0;
let lastTime = 0;
 
//distinct colors for readPixels
let COLORS = [
  [0.0, 0.0, 1.0],   // blue
  [1.0, 0.0, 0.0],   // red
  [0.0, 0.8, 0.0],   // green
  [1.0, 0.5, 0.0],   // orange
  [0.8, 0.0, 0.8],   // purple
];
 
function spawnBac(i){
  // generate random position using two angles (assignment hint)
  let phi   = Math.acos(2*Math.random() - 1);
  let theta = Math.random() * 2*Math.PI;
  return { phi, theta, bRad: 0.05, col: COLORS[i % COLORS.length], dead: false, hitThreshold: false };
}
 
function drawBac(b, posLoc, colLoc){
  // draw bacterium as a small sphere centered at its position on the main sphere
  // using a slightly larger radius so it sits on top of the main sphere surface
  let R = 1.5;
  let cx = R * Math.sin(b.phi) * Math.cos(b.theta);
  let cy = R * Math.sin(b.phi) * Math.sin(b.theta);
  let cz = R * Math.cos(b.phi);
 
  let verts = [], cols = [], idx = [];
  let lat = 12, lon = 12;
 
  for(let i = 0; i <= lat; i++){
    let p = (i / lat) * Math.PI;
    for(let j = 0; j <= lon; j++){
      let t = (j / lon) * 2*Math.PI;
      verts.push(cx + b.bRad * Math.sin(p) * Math.cos(t),
                 cy + b.bRad * Math.sin(p) * Math.sin(t),
                 cz + b.bRad * Math.cos(p));
      cols.push(b.col[0], b.col[1], b.col[2]);
    }
  }
 
  for(let i = 0; i < lat; i++){
    for(let j = 0; j < lon; j++){
      let tl = i*(lon+1)+j, tr=tl+1, bl=tl+(lon+1), br=bl+1;
      idx.push(tl, bl, tr);
      idx.push(tr, bl, br);
    }
  }
 
  let vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(posLoc);
 
  let cb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cols), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(colLoc);
 
  let ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.DYNAMIC_DRAW);
  gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
}
 
function tryKill(){
  if(gameOver) return;
 
  // read the pixel color under the mouse cursor
  let px = new Uint8Array(4);
  let flippedY = canvas.height - Math.round(mouseY);  // WebGL y-axis is flipped
  gl.readPixels(Math.round(mouseX), flippedY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
 
  for(let b of bacteria){
    if(b.dead) continue;
    // compare pixel to bacteria color with a small tolerance
    let dr = Math.abs(px[0]/255 - b.col[0]);
    let dg = Math.abs(px[1]/255 - b.col[1]);
    let db = Math.abs(px[2]/255 - b.col[2]);
    if(dr < 0.15 && dg < 0.15 && db < 0.15){
      b.dead = true;
      playerPts++;
      return;
    }
  }
}
 
function updateUI(){
  document.getElementById('player_points').innerHTML = 'Player points: ' + playerPts;
  document.getElementById('game_points').innerHTML   = 'Game points: '   + gamePts.toFixed(1);
}
 
function setResult(t){
  document.getElementById('result').innerHTML = t;
}
 
function gameLoop(now){
  let dt = (now - lastTime) / 1000;
  lastTime = now;
 
  if(!gameOver){
    // grow all live bacteria
    for(let b of bacteria){
      if(b.dead) continue;
      b.bRad += speed * dt;
 
      // check if bacterium hit the threshold size
      if(!b.hitThreshold && b.bRad >= THRESHOLD){
        b.hitThreshold = true;
        threshCount++;
        gamePts += 5;
      }
    }
 
    // game wins if 2 bacteria reach threshold
    if(threshCount >= 2){
      gameOver = true;
      setResult('You lose :(');
    }
 
    // player wins if all bacteria are dead
    let alive = bacteria.filter(b => !b.dead).length;
    if(!gameOver && alive === 0){
      gameOver = true;
      setResult('You win! All bacteria eliminated!');
    }
 
    // game gains small points over time (delay penalty)
    gamePts += dt * 0.5;
  }
 
  updateUI();
  draw();
  requestAnimationFrame(gameLoop);
}
 
function draw(){
  gl.clearColor(0.05, 0.05, 0.05, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
 
  moMatrix.setIdentity();
  moMatrix.rotate(rotX, 1, 0, 0);
  moMatrix.rotate(rotY, 0, 1, 0);
  gl.uniformMatrix4fv(_M, false, moMatrix.elements);
 
  let pos = gl.getAttribLocation(gl.program, 'position');
  let col = gl.getAttribLocation(gl.program, 'color');
 
  // draw main sphere
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertBuf);
  gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(pos);
 
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereColBuf);
  gl.vertexAttribPointer(col, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(col);
 
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIdxBuf);
  gl.drawElements(gl.TRIANGLES, sphereIdxCount, gl.UNSIGNED_SHORT, 0);
 
  // draw each live bacterium on top
  for(let b of bacteria){
    if(!b.dead) drawBac(b, pos, col);
  }
}

 
function buildSphere(R, latBands, longBands){
  let verts = [], cols = [], idx = [];
 
  for(let lat = 0; lat <= latBands; lat++){
    let phi = (lat / latBands) * Math.PI;
    for(let lon = 0; lon <= longBands; lon++){
      let theta = (lon / longBands) * 2*Math.PI;
 
      verts.push(R * Math.sin(phi) * Math.cos(theta),
                 R * Math.sin(phi) * Math.sin(theta),
                 R * Math.cos(phi));
 
      if(lat % 6 === 0 && lon % 6 === 0){
        cols.push(1.0, 1.0, 1.0);
      } else {
        cols.push(0.6, 0.6, 0.6);
      }
    }
  }
 
  for(let lat = 0; lat < latBands; lat++){
    for(let lon = 0; lon < longBands; lon++){
      let tl = lat*(longBands+1)+lon, tr=tl+1, bl=tl+(longBands+1), br=bl+1;
      idx.push(tl, bl, tr);
      idx.push(tr, bl, br);
    }
  }
 
  sphereIdxCount = idx.length;
 
  sphereVertBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
 
  sphereColBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereColBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cols), gl.STATIC_DRAW);
 
  sphereIdxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIdxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
}
 
function main(){
  canvas = document.getElementById('webgl');
 
  // preserveDrawingBuffer is needed for gl.readPixels to work
  gl = canvas.getContext('webgl', {preserveDrawingBuffer: true}) ||
       canvas.getContext('experimental-webgl', {preserveDrawingBuffer: true});
  if(!gl){ console.log('no webgl'); return; }
 
  if(!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)){
    console.log('shader failed'); return;
  }
 
  buildSphere(1.5, 60, 90);
 
  let proj = new Matrix4();
  proj.setPerspective(60, canvas.width/canvas.height, 0.1, 100);
 
  let view = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  view[14] = view[14] - 6;
 
  _P = gl.getUniformLocation(gl.program, 'Pmatrix');
  _V = gl.getUniformLocation(gl.program, 'Vmatrix');
  _M = gl.getUniformLocation(gl.program, 'Mmatrix');
 
  gl.uniformMatrix4fv(_P, false, proj.elements);
  gl.uniformMatrix4fv(_V, false, view);
 
  gl.enable(gl.DEPTH_TEST);
 
  // spawn bacteria
  for(let i = 0; i < maxB; i++) bacteria.push(spawnBac(i));
 
  // drag to rotate
  canvas.addEventListener('mousedown', function(e){
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
 
  canvas.addEventListener('mousemove', function(e){
    let r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
 
    if(!isDragging) return;
    let dx = e.clientX - lastX;
    let dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    rotY += dx * 0.4;
    rotX += dy * 0.4;
  });
 
  canvas.addEventListener('mouseup',    function(){ isDragging = false; });
  canvas.addEventListener('mouseleave', function(){ isDragging = false; });
 
  // press space to kill bacteria under cursor
  document.addEventListener('keydown', function(e){
    if(e.code === 'Space') tryKill();
  });
 
  requestAnimationFrame(gameLoop);
}
 
main();