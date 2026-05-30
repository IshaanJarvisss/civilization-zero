const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

// --- SIMULATION SETTINGS ---
const GRID_SIZE = 40; 
const TILE_SIZE = 16;
canvas.width = GRID_SIZE * TILE_SIZE;
canvas.height = GRID_SIZE * TILE_SIZE;

let day = 0;
let dayTimer = 0;
const DAY_DURATION = 300; // Frames per simulated day

let grid = [];
let agents = [];
const TILE = { LAND: 0, WATER: 1, FOOD: 2 };

// --- 1. PRIMORDIAL WORLD GENERATION ---
function initWorld() {
    grid = [];
    for (let x = 0; x < GRID_SIZE; x++) {
        grid[x] = [];
        for (let y = 0; y < GRID_SIZE; y++) {
            let type = TILE.LAND;
            let rand = Math.random();
            
            if (rand < 0.08) type = TILE.WATER;       // Natural water sources
            else if (rand < 0.15) type = TILE.FOOD;   // Natural berry bushes/plants
            
            grid[x][y] = { type: type, originalType: type };
        }
    }

    // SPARK OF LIFE: Exactly 4 autonomous agents are born with random genetics
    for (let i = 0; i < 4; i++) {
        agents.push(new Agent(
            Math.floor(Math.random() * GRID_SIZE),
            Math.floor(Math.random() * GRID_SIZE),
            null,
            `Gen0_Adam_${i+1}`
        ));
    }
    logEvent("GENESIS: 4 primitive souls dropped into the void. They are entirely on their own.");
}

// --- 2. AUTONOMOUS AGENT BRAIN & DNA ---
class Agent {
    constructor(x, y, parentDNA = null, name = "Unnamed") {
        this.x = x;
        this.y = y;
        this.name = name;
        
        // GENETICS (Inheritable behavioral traits)
        if (parentDNA) {
            // Replicate parent traits with random MUTATION (+/- 20% drift)
            this.dna = {
                aggression: Math.max(0, Math.min(1, parentDNA.aggression + (Math.random() * 0.4 - 0.2))),
                curiosity: Math.max(0, Math.min(1, parentDNA.curiosity + (Math.random() * 0.4 - 0.2)))
            };
        } else {
            // First generation gets completely random DNA values
            this.dna = { 
                aggression: Math.random(), 
                curiosity: Math.random() 
            };
        }

        // PHYSICAL VITALITY (0 = Dead, 100 = Full)
        this.hunger = 100;
        this.thirst = 100;
        this.age = 0;
        
        // PERSISTENT MEMORY (Remembers locations of resources they stumble upon)
        this.memory = []; 
    }

    update() {
        this.age++;
        this.hunger -= 0.4;  // Burning energy over time
        this.thirst -= 0.6;  // Getting dehydrated over time

        // Death Check
        if (this.hunger <= 0 || this.thirst <= 0) {
            logEvent(`${this.name} has succumbed to starvation/dehydration.`);
            return false; 
        }

        // DECISION TREE (Autonomous Survival Instincts)
        if (this.thirst < 50) {
            this.seekResource(TILE.WATER);
        } else if (this.hunger < 50) {
            this.seekResource(TILE.FOOD);
        } else {
            // If secure, curiosity dictates movement
            if (Math.random() < this.dna.curiosity) {
                this.wanderFar();
            } else {
                this.wanderNear();
            }
        }

        // Environmental Consumption
        this.consumeSurroundings();

        // REPRODUCTION (Only if perfectly nourished and lucky)
        if (this.hunger > 80 && this.thirst > 80 && Math.random() < 0.005) {
            this.splitAndReplicate();
        }

        return true; 
    }

    wanderNear() {
        this.x = Math.max(0, Math.min(GRID_SIZE - 1, this.x + Math.floor(Math.random() * 3) - 1));
        this.y = Math.max(0, Math.min(GRID_SIZE - 1, this.y + Math.floor(Math.random() * 3) - 1));
    }

    wanderFar() {
        // High curiosity pushes them to leap cross-grid to scan brand new regions
        this.x = Math.max(0, Math.min(GRID_SIZE - 1, this.x + Math.floor(Math.random() * 5) - 2));
        this.y = Math.max(0, Math.min(GRID_SIZE - 1, this.y + Math.floor(Math.random() * 5) - 2));
    }

    seekResource(type) {
        // Look inside own memory array first
        let destination = this.memory.find(m => m.type === type);
        
        if (!destination) {
            // If memory is empty, scan local dynamic vision field (Radius of 4 tiles)
            for (let dx = -4; dx <= 4; dx++) {
                for (let dy = -4; dy <= 4; dy++) {
                    let nx = this.x + dx;
                    let ny = this.y + dy;
                    if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                        if (grid[nx][ny].type === type) {
                            destination = { x: nx, y: ny, type: type };
                            this.memory.push(destination); // Lock into memory bank
                            break;
                        }
                    }
                }
            }
        }

        if (destination) {
            // Walk toward the discovered resource coordinate
            this.x += Math.sign(destination.x - this.x);
            this.y += Math.sign(destination.y - this.y);
        } else {
            this.wanderNear();
        }
    }

    consumeSurroundings() {
        let currentTile = grid[this.x][this.y];
        
        // Eat food directly underneath
        if (currentTile.type === TILE.FOOD) {
            this.hunger = 100;
            grid[this.x][this.y].type = TILE.LAND; // Resource is depleted
        }
        
        // Drink from adjacent water structures
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
        // Multi-generational emergence via cell-division reproduction
        let childName = `Gen_${day}_Node_${agents.length + 1}`;
        agents.push(new Agent(this.x, this.y, this.dna, childName));
        this.hunger -= 30; // High metabolic cost to reproduce
        logEvent(`EMERGENCE: ${this.name} passed down its DNA line to ${childName}.`);
    }
}

// --- 3. CORE EVOLUTION CONTROLLER ---
function updateSimulation() {
    dayTimer++;
    if (dayTimer >= DAY_DURATION) {
        day++;
        dayTimer = 0;
        regrowEnvironment();
    }

    // Run the active brain update for all living agents
    agents = agents.filter(agent => agent.update());

    // Sync Live Data to Panel Display
    document.getElementById('stat-day').innerText = day;
    document.getElementById('stat-pop').innerText = agents.length;
    
    let currentFood = 0;
    grid.forEach(row => row.forEach(tile => { if(tile.type === TILE.FOOD) currentFood++ }));
    document.getElementById('stat-res').innerText = currentFood;

    // Check for Global Collapse
    if (agents.length === 0) {
        document.getElementById('stat-status').innerText = "EXTINCT";
        document.getElementById('stat-status').style.color = "#ff0055";
    }
}

function regrowEnvironment() {
    // Nature slowly reclaims stripped tiles over time
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            if (grid[x][y].originalType === TILE.FOOD && grid[x][y].type === TILE.LAND) {
                if (Math.random() < 0.15) { // 15% chance to sprout back each new day
                    grid[x][y].type = TILE.FOOD;
                }
            }
        }
    }
}

function logEvent(msg) {
    const logBox = document.getElementById('log-box');
    logBox.innerHTML += `<div>[Day ${day}] ${msg}</div>`;
    logBox.scrollTop = logBox.scrollHeight;
}

// --- 4. RENDER MATRIX ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render Tile Map Layout
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            if (grid[x][y].type === TILE.WATER) ctx.fillStyle = '#1a2b3c';
            else if (grid[x][y].type === TILE.FOOD) ctx.fillStyle = '#1b4d3e';
            else ctx.fillStyle = '#131317'; // Barren Land Grid
            
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
        }
    }

    // Render Living Agents
    agents.forEach(agent => {
        // Visual indicator of current personality traits based on DNA strand:
        // Red = Aggressive tendencies, Blue = Passive/Curious wanderers
        let red = Math.floor(agent.dna.aggression * 255);
        let blue = Math.floor((1 - agent.dna.aggression) * 255);
        
        ctx.fillStyle = `rgb(${red}, 100, ${blue})`;
        ctx.shadowColor = `rgb(${red}, 100, ${blue})`;
        ctx.shadowBlur = 4;
        
        ctx.beginPath();
        ctx.arc(agent.x * TILE_SIZE + TILE_SIZE/2, agent.y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/3.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0; // Reset canvas shadow state
    });
}

function runEngineLoop() {
    updateSimulation();
    draw();
    requestAnimationFrame(runEngineLoop);
}

// Spark Universe
initWorld();
runEngineLoop();
