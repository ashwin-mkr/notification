import { Component } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { FeatherIconsComponent } from "../../feather-icons/feather-icons.component";

@Component({
  selector: "app-profile",
  standalone:true,
  imports:[FeatherIconsComponent,RouterModule],
  templateUrl: "./profile.component.html",
  styleUrls: ["./profile.component.scss"],
})

export class ProfileComponent {

  public isShow: boolean = false;

  constructor(public router: Router) {}

  logOut() {
    localStorage.clear();
    this.router.navigateByUrl("/auth/login");
  }
  
}
