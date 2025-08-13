import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule, NavigationEnd } from "@angular/router";
import { HideScrollNavService } from "../../services/hidescrollnav.service";
import { LayoutService } from "../../services/layout.service";
import { NavService } from "../../services/nav.service";
import { SearchService } from "../../services/search.service";
import { BreadcrumbComponent } from "../breadcrumb/breadcrumb.component";
import { CommonSvgIconComponent } from "../common-svg-icon/common-svg-icon.component";
import { FeatherIconsComponent } from "../feather-icons/feather-icons.component";
import { SvgIconComponent } from "../svg-icon/svg-icon.component";
import { MessagesComponent } from "./messages/messages.component";
import { NotificationsComponent } from "./notifications/notifications.component";
import { ProfileComponent } from "./profile/profile.component";
import { ThemeModeComponent } from "./theme-mode/theme-mode.component";

@Component({
  selector: "app-header",
  standalone: true,
  imports: [
    CommonSvgIconComponent,
    RouterModule,
    SvgIconComponent,
    FeatherIconsComponent,
    FormsModule,
    CommonModule,
    NotificationsComponent,
    ThemeModeComponent,
    MessagesComponent,
    ProfileComponent,
    BreadcrumbComponent,
  ],
  templateUrl: "./header.component.html",
  styleUrls: ["./header.component.scss"],
})
export class HeaderComponent implements OnInit {
  public isFlip: boolean = false;
  public isSearchOpen: boolean = false;
  public open: boolean = false;
  public showPopup: boolean = false;
  public walletAmount: number = 1000;

  public leftArrowNone: boolean = true;
  public rightArrowNone: boolean = false;
  public margin: number = 0;
  public width: number = window.innerWidth;

  public menuItemsList: any[] = [];
  public pinnedData: boolean = false;
  public pinnedDataList: string[] = [];

  constructor(
    private router: Router,
    public navService: NavService,
    public hideScrollNavService: HideScrollNavService,
    public searchService: SearchService,
    public layoutService: LayoutService
  ) {}

  ngOnInit(): void {
    // Initialize the menu items safely after navService is available
    this.menuItemsList = this.navService.MENUITEMS;

    // Optional: subscribe to dynamic menu updates if needed
    this.navService.items.subscribe((menuItems) => {
      this.menuItemsList = menuItems;
    });

    // Optional: Uncomment if you want to track route changes and activate menu
    // this.router.events.subscribe((event) => {
    //   if (event instanceof NavigationEnd) {
    //     this.updateActiveMenu(event.url);
    //   }
    // });
  }

  togglePopup(): void {
    this.showPopup = !this.showPopup;
  }

  navigaterefer(): void {
    this.router.navigate(["/referral"]);
  }

  sidebarToggle(): void {
    this.navService.collapseSidebar = !this.navService.collapseSidebar;
  }

  navigateToAddCustomer(): void {
    this.togglePopup();
    this.router.navigate(["sidebar/addcustomer"]);
  }

  navigateToAddVendor(): void {
    this.togglePopup();
    this.router.navigate(["sidebar/addvendor"]);
  }

  // Optional helper if you want to auto-highlight the active menu item on route change
  // private updateActiveMenu(currentUrl: string): void {
  //   this.menuItemsList.forEach((item) => {
  //     item.active = item.path === currentUrl;
  //     item.children?.forEach((child) => {
  //       child.active = child.path === currentUrl;
  //       child.children?.forEach((subChild) => {
  //         subChild.active = subChild.path === currentUrl;
  //       });
  //     });
  //   });
  // }
}
