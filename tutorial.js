// A practice run uses real controls, without touching story save slots.
export class PracticeGuide {
  constructor({show, spawn, healed, finish, prepareHeal, supplies}) {
    Object.assign(this,{show,spawn,healed,finish,prepareHeal,supplies}); this.active=false;
    this.steps=[
      ['Walk around','Walk a few steps. Mouse or arrow keys turn the camera.','walk','W A S D','↟'],
      ['Stay quiet','Crouch to soften your footsteps. Press C again to stand.','crouch','C','↓'],
      ['Run when safe','Stand up, then hold Shift while moving. Running attracts infected.','run','SHIFT + W','↗'],
      ['Get out of reach','Press Space while moving to dodge. A short recovery follows each dodge.','dodge','SPACE','↔'],
      ['Open your backpack','Everything you carry is here. Hover to inspect; click to hold.','pack','TAB','▦'],
      ['Hold your pistol','Click Pistol. One item fits in your hand at a time. Click it again in the pack to stow it.','equip','PISTOL → CLICK','⌖'],
      ['Fire a practice shot','Left click fires. Right click or Z aims. R reloads from spare ammunition.','fire','CLICK · Z AIM · R RELOAD','⌖'],
      ['Find cloth and alcohol','Follow the two gold markers nearby. Approach each supply and press E. In the story, search shelves, rooms and storerooms.','supplies','E PICK UP','◇'],
      ['Make a health kit','Open Tab. In Craft, click Health Kit: 1 cloth + 1 alcohol. Wait for crafting to finish. The same ingredients also make a Molotov.','craft','TAB → CRAFT → HEALTH KIT','+'],
      ['One practice infected','A slow infected is approaching. Aim and shoot, or use F for melee. It cannot kill you in practice.','enemy','Z AIM · CLICK SHOOT','⌖'],
      ['Treat your injury','This is a simulated injury. Press H to use your crafted kit, or click it in Supplies. Wait for the wrap to finish.','heal','H HEAL','+'],
      ['Ready for the story','Find cloth, alcohol, ammunition, blades and binding as you explore. Supplies are limited. Your practice items reset for the story.','done','T BEGIN STORY','✓'],
    ];
  }
  start() {this.active=true;this.i=0;this.elapsed=0;this.move=0;this.render();}
  stop() {this.active=false;this.show(null);}
  render() {const [title,body,event,keys,icon]=this.steps[this.i];this.show({title,body,event,keys,icon,index:this.i+1,total:this.steps.length});}
  signal(event) {
    if(!this.active || this.steps[this.i][2]!==event)return;
    if(this.i===this.steps.length-1)return;
    this.i++;this.elapsed=0;this.move=0;
    if(this.steps[this.i][2]==='enemy')this.spawn();
    if(this.steps[this.i][2]==='heal')this.prepareHeal();
    if(this.steps[this.i][2]==='supplies')this.supplies();
    this.render();
  }
  update(dt,P) {
    if(!this.active)return;this.elapsed+=dt;
    if(this.steps[this.i][2]==='walk'){this.move+=P.speed*dt;if(this.move>1.5)this.signal('walk');}
    if(this.steps[this.i][2]==='crouch' && P.crouch)this.signal('crouch');
    if(this.steps[this.i][2]==='pack' && P.packOpen)this.signal('pack');
    if(this.steps[this.i][2]==='equip' && P.weapon==='pistol')this.signal('equip');
    if(this.steps[this.i][2]==='craft' && P.items.kit>0 && !(P.craftT>0))this.signal('craft');
    if(this.steps[this.i][2]==='run' && P.speed>3.2)this.signal('run');
    if(this.steps[this.i][2]==='supplies' && P.items.cloth>=1 && P.items.alcohol>=1)this.signal('supplies');
    if(this.steps[this.i][2]==='heal' && this.healed())this.signal('heal');
  }
  leave(){if(!this.active)return;this.stop();this.finish();}
}
