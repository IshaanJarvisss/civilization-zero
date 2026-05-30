const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

// Grid Setup (Slightly smaller map so the 4 agents find each other easier)
const GRID_SIZE = 30; 
const TILE_SIZE = 22; // Bigger tiles so it looks like a clear 2D world map
canvas.width = GRID_SIZE * TILE_SIZE;
canvas.height = GRID_SIZE * TILE_SIZE;

let day = 0;
let dayTimer = 0;
const DAY_DURATION = 200; 

let grid = [];
let agents = [];
let totalBirths = 4; // Tracks unique IDs cleanly
const TILE = { LAND: 0, WATER: 1, FOOD: 2 };

// --- 1. MAP GENERATION ---
function initWorld() {
    grid = [];
    for (let x = 0; x < GRID_SIZE; x++) {
        grid[x] = [];
        for (let y = 0; y < GRID_SIZE; y++) {
            let type = TILE.LAND;
            let rand = Math.random();
            
            // Create clear clumps of water patches and food patches
            if (rand < 0.07) type = TILE.WATER;       
            else if (rand < 0.14) type = TILE.FOOD;   
            
            grid[x][y] = { type: type, originalType: type };
        }
    }

    // Spawn 4 distinct, colorful genetic founders
    let tribeColors = [0, 120, 220, 280]; // Red, Green, Blue, Purple
    let tribeNames = ["Alpha", "Beta", "Gamma", "Delta"];
    
    for (let i = 0; i < 4; i++) {
        agents.push(new Agent(
            Math.floor(Math.random() * GRID_SIZE),
            Math.floor(Math.random() * GRID_SIZE),
            null,
            `Founder_${tribeNames[i]}`,
            tribeColors[i]
        ));
    }
    logEvent("GENESIS: 4 isolated factions dropped into the grid matrix.");
}

// --- 2. AGENT LOGIC ENGINE ---
class Agent {
    constructor(x, y, parent = null, name = "Unnamed", tribeColor = 0) {
        this.x = x;
        this.y = y;
        this.name = name;
        this.tribeColor = tribeColor;
        this.isAttacking = false;

        if (parent) {
            this.dna = {
                aggression: Math.max(0, Math.min(1, parent.dna.aggression + (Math.random() * 0.2 - 0.1))),
                curiosity: Math.max(0, Math.min(1, parent.dna.curiosity + (Math.random() * 0.2 - 0.1)))
            };
            this.memory = [...parent.memory]; // Inherit locations
        } else {
            this.dna = { aggression: Math.random(), curiosity: Math.random() };
            this.memory = [];
        }

        this.hunger = 100;
        this.thirst = 100;
        this.age = 0;
    }

    update() {
        this.age++;
        this.hunger -= 0.3;  
        this.thirst -= 0.4;  
        this.isAttacking = false;

        if (this.hunger <= 0 || this.thirst <= 0) {
            logEvent(`${this.name} died of starvation/dehydration.`);
            return false; 
        }

        // Combat behavior if highly aggressive
        if (this.dna.aggression > 0.6 && this.hunger < 60) {
            this.huntRivals();
        }

        // Standard Survival Loop
        if (this.thirst < 50) {
            this.seekResource(TILE.WATER);
        } else if (this.hunger < 50) {
            this.seekResource(TILE.FOOD);
        } else {
            if (Math.random() < this.dna.curiosity) this.wanderFar();
            else this.wanderNear();
        }

        this.consumeSurroundings();

        // Balanced reproduction constraint
        if (this.hunger > 85 && this.thirst > 85 && Math.random() < 0.005 && agents.length < 40) {
            this.splitAndReplicate();
        }

        return true; 
    }

    wanderNear() {
        this.x = Math.max(0, Math.min(GRID_SIZE - 1, this.x + Math.floor(Math.random() * 3) - 1));
        this.y = Math.max(0, Math.min(GRID_SIZE - 1, this.y + Math.floor(Math.random() * 3) - 1));
    }

    wanderFar() {
        this.x = Math.max(0, Math.min(GRID_SIZE - 1, this.x + Math.floor(Math.random() * 5) - 2));
        this.y = Math.max(0, Math.min(GRID_SIZE - 1, this.y + Math.floor(Math.random() * 5) - 2));
    }

    seekResource(type) {
        let target = this.memory.find(m => m.type === type);
        
        if (!target) {
            // Field of view scan
            for (let dx = -5; dx <= 5; dx++) {
                for (let dy = -5; dy <= 5; dy++) {
                    let nx = this.x + dx;
                    let ny = this.y + dy;
                    if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                        if (grid[nx][ny].type === type) {
                            target = { x: nx, y: ny, type: type };
                            this.memory.push(target);
                            break;
                        }
                    }
                }
            }
        }

        if (target) {
            this.x += Math.sign(target.x - this.x);
            this.y += Math.sign(target.y - this.y);
        } else {
            this.wanderNear();
        }
    }

    huntRivals() {
        // Track agents belonging to completely different family colors
        let rival = agents.find(a => a !== this && a.tribeColor !== this.tribeColor);
        if (rival) {
            let dist = Math.abs(this.x - rival.x) + Math.abs(this.y - rival.y);
            if (dist <= 1) {
                this.isAttacking = true;
                rival.hunger -= 30; // Drain rival
                this.hunger = Math.min(100, this.hunger + 25); // Replenish self
                if (Math.random() < 0.05) {
                    logEvent(`CONFLICT: ${this.name} raided a rival node territory.`);
                }
            } else {
                this.x += Math.sign(rival.x - this.x);
                this.y += Math.sign(rival.y - this.y);
            }
        }
    }

    consumeSurroundings() {
        let currentTile = grid[this.x][this.y];
        if (currentTile.type === TILE.FOOD) {
            this.hunger = 100;
            grid[this.x][this.y].type = TILE.LAND; 
        }
        if (this.isNearWater()) {
            this.thirst = 100;
        }
    }

    isNearWater() {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                let nx = this.x + dx;
                let ny = this.y + dy;
                if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                    if (grid[nx][ny].type === TILE.WATER) return true;
                }
            }
        }
        return false;
    }

    splitAndReplicate() {
        totalBirths++;
        let childName = `Node_${totalBirths}`;
        agents.push(new Agent(this.x, this.y, this, childName, this.tribeColor));
        this.hunger -= 40; 
        logEvent(`EVOLUTION: ${this.name} birthed ${childName}, passing down behavioral DNA.`);
    }
}

// --- 3. SYSTEM LOOP ---
function updateSimulation() {
    dayTimer++;
    if (dayTimer >= DAY_DURATION) {
        day++;
        dayTimer = 0;
        regrowEnvironment();
    }

    agents = agents.filter(agent => agent.update());

    document.getElementById('stat-day').innerText = day;
    document.getElementById('stat-pop').innerText = agents.length;
    
    let currentFood = 0;
    grid.forEach(row => row.forEach(tile => { if(tile.type === TILE.FOOD) currentFood++ }));
    document.getElementById('stat-res').innerText = currentFood;

    if (agents.length === 0) {
        document.getElementById('stat-status').innerText = "WORLD COLLAPSE";
        document.getElementById('stat-status').style.color = "#ff0055";
    }
}

function regrowEnvironment() {
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            if (grid[x][y].originalType === TILE.FOOD && grid[x][y].type === TILE.LAND) {
                if (Math.random() < 0.2) grid[x][y].type = TILE.FOOD; 
            }
        }
    }
}

function logEvent(msg) {
    const logBox = document.getElementById('log-box');
    logBox.innerHTML += `<div>[Day ${day}] ${msg}</div>`;
    logBox.scrollTop = logBox.scrollHeight;
}

// --- 4. VISUAL RENDER ENGINE ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the 2D grid boxes clearly
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            if (grid[x][y].type === TILE.WATER) ctx.fillStyle = '#112233'; // Blue-ish water tile
            else if (grid[x][y].type === TILE.FOOD) ctx.fillStyle = '#143b29';  // Green berry bush tile
            else ctx.fillStyle = '#0f0f13'; // Plain land grid box
            
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
        }
    }

    // Draw Agents as neon entity orbs
    agents.forEach(agent => {
        if (agent.isAttacking) {
            ctx.fillStyle = '#ff0055'; // Flash hot pink/red during a fight
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 12;
        } else {
            ctx.fillStyle = `hsl(${agent.tribeColor}, 95%, 55%)`; // Saturated faction color
            ctx.shadowColor = `hsl(${agent.tribeColor}, 95%, 55%)`;
            ctx.shadowBlur = 6;
        }
        
        ctx.beginPath();
        ctx.arc(agent.x * TILE_SIZE + TILE_SIZE / 2, agent.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; 
    });
}

function runEngineLoop() {
    updateSimulation();
    draw();
    requestAnimationFrame(runEngineLoop);
}

initWorld();
runEngineLoop();
