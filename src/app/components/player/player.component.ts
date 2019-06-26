import {Component,  OnInit, ElementRef} from '@angular/core';
import {MpvJs} from '../../../lib/mpvjs';
import {remote} from 'electron';

@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent implements OnInit {
  public mpv: MpvJs;
  public seeking: boolean;
  public state: any =  {pause: false, "time-pos": 0, duration: 0, fullscreen: false};
  public embedProps: any;
  public embed: any;

  constructor(public elRef: ElementRef) {
    this.mpv = new MpvJs(this.handleMPVReady, this.handlePropertyChange);
    this.embedProps = this.mpv.getDefProps();
  }

  ngOnInit() {
    this.embed = this.elRef.nativeElement.querySelector('embed');
    this.mpv.setPluginNode(this.embed);
  }
  ngAfterViewInit(){
    document.addEventListener("keydown", this.handleKeyDown, false);
  }
  ngOnDestroy(){
    document.removeEventListener("keydown", this.handleKeyDown, false);
  }
  handleKeyDown = (e) => {
    e.preventDefault();
    if (e.key === "f" || (e.key === "Escape" && this.state.fullscreen)) {
      this.toggleFullscreen();
    } else if (this.state.duration) {
      this.mpv.keypress(e);
    }
  }
  handleMPVReady = (mpv) => {
    const observe = mpv.observe.bind(mpv);
    ["pause", "time-pos", "duration", "eof-reached"].forEach(observe);
    this.mpv.property("hwdec", "auto");
  }
  handlePropertyChange = (name, value) => {
    if (name === "time-pos" && this.seeking) {
      return;
    } else if (name === "eof-reached" && value) {
      this.mpv.property("time-pos", 0);
    } else {
      this.state[name] = value;
    }
  }
  toggleFullscreen = () => {
    if (this.state.fullscreen) {
      document['webkitExitFullscreen']();
    } else {
      this.mpv.fullscreen();
    }
    this.state.fullscreen = !this.state.fullscreen;
  }
  togglePause = (e) => {
    e.target.blur();
    if (!this.state.duration) return;
    this.mpv.property("pause", !this.state.pause);
  }
  handleStop = (e) => {
    e.target.blur();
    this.mpv.property("pause", true);
    this.mpv.command("stop");
    this.state['time-pos'] = 0;
    this.state.duration = 0;
  }
  handleSeekMouseDown = () => {
    this.seeking = true;
  }
  handleSeek = (e) => {
    e.target.blur();
    const timePos = +e.target.value;
    this.state["time-pos"] = timePos;
    this.mpv.property("time-pos", timePos);
  }
  handleSeekMouseUp = () => {
    this.seeking = false;
  }
  handleLoad = (e) => {
    e.target.blur();
    const items = remote.dialog.showOpenDialog({
      filters: [{
          name: "Videos",
          extensions: ["mkv", "webm", "mp4", "mov", "avi"]
        },
        {
          name: "All files",
          extensions: ["*"]
        },
      ]
    });
    if (items) {
      this.mpv.command("loadfile", items[0]);
      this.togglePause(e);
    }
  }


}
