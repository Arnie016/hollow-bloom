// A practice run uses the real controls, without touching story save slots.
export class PracticeGuide {
  constructor({show, spawn, healed, finish, prepareHeal}) {
    Object.assign(this,{show,spawn,healed,finish,prepareHeal}); this.active=false;
    this.steps=[
      ['Walk around','WASD moves. Mouse or arrow keys look around. Walk a few steps.','walk'],
      ['Stay quiet','Press C to crouch. Crouching makes your footsteps quieter.','crouch'],
      ['Run when safe','Press C again to stand. Hold Shift while moving to run.','run'],
      ['Open your backpack','Press Tab. Hover to inspect; click once or press Enter to hold a weapon.','pack'],
      ['Hold your pistol','Click the Pistol. The backpack closes and the pistol appears in Wren’s hand. Only one item is held at a time.','equip'],
      ['Fire a practice shot','Left click shoots the held pistol. Right click or Z aims more precisely. Enter also fires.','fire'],
      ['One practice infected','A slow practice infected is approaching. Aim and shoot, or use F for melee. This practice cannot kill you.','enemy'],
      ['Antiseptic and a clean wrap','You have a simulated injury. Press H, or click Health Kit in the backpack. Wait for the bandage to finish.','heal'],
      ['Ready for the story','Your health and ammunition reset when you leave practice. Press T to begin the story.','done'],
    ];
  }
  start() { this.active=true;this.i=0;this.elapsed=0;this.move=0;this.render(); }
  stop() { this.active=false;this.show(null); }
  render() { const [title,body]=this.steps[this.i];this.show({title,body,index:this.i+1,total:this.steps.length}); }
  signal(event) { if(!this.active || this.steps[this.i][2]!==event) return;this.i++;this.elapsed=0;this.move=0;if(this.steps[this.i][2]==='enemy')this.spawn();if(this.steps[this.i][2]==='heal')this.prepareHeal();this.render(); }
  update(dt,P) {
    if(!this.active)return;this.elapsed+=dt;
    if(this.steps[this.i][2]==='walk') {this.move+=P.speed*dt;if(this.move>1.5)this.signal('walk');}
    if(this.steps[this.i][2]==='run' && P.speed>3.2)this.signal('run');
    if(this.steps[this.i][2]==='heal' && this.healed())this.signal('heal');
  }
  leave() {if(!this.active)return;this.stop();this.finish();}
}
