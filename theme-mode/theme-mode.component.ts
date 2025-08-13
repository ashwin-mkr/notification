import {Component, OnInit} from "@angular/core";
import { LayoutService } from "../../../../shared/services/layout.service";
import { CommonSvgIconComponent } from "../../common-svg-icon/common-svg-icon.component";

@Component({
  selector: "app-theme-mode",
  templateUrl: "./theme-mode.component.html",
  standalone:true,
  imports:[CommonSvgIconComponent],
  styleUrls: ["./theme-mode.component.scss"],
})
export class ThemeModeComponent implements OnInit {

  public dark = false;

  constructor(public layout: LayoutService) {}
  ngOnInit() {
    this.dark = this.layout.config.settings.layout_version == "dark-only" ? true : false
  }

  layoutToggle() {
    this.dark = !this.dark;
    this.dark ? document.body.classList.add("dark-only") : document.body.classList.remove("dark-only");
    this.layout.config.settings.layout_version = this.dark ? "dark-only" : "light";
  }
}
