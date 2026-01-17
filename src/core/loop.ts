type TickCallback = (dt: number) => void;

export class GameLoop {
  private lastTime: number = 0;
  private running: boolean = false;
  private logicTickCallbacks: TickCallback[] = [];
  private renderTickCallbacks: TickCallback[] = [];

  constructor() {}

  public start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  public stop() {
    this.running = false;
  }

  public addLogicSystem(callback: TickCallback) {
    this.logicTickCallbacks.push(callback);
  }

  public addRenderSystem(callback: TickCallback) {
    this.renderTickCallbacks.push(callback);
  }

  private loop(currentTime: number) {
    if (!this.running) return;

    // Calculate Delta Time in seconds
    const dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Run Logic Systems (Simulation)
    // We could implement fixed time step here later if needed
    for (const sys of this.logicTickCallbacks) {
      sys(dt);
    }

    // Run Render Systems (Visuals)
    for (const sys of this.renderTickCallbacks) {
      sys(dt);
    }

    requestAnimationFrame(this.loop.bind(this));
  }
}

export const gameLoop = new GameLoop();
