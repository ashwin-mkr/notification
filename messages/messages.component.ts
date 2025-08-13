import { Component } from '@angular/core';
import { CommonSvgIconComponent } from '../../common-svg-icon/common-svg-icon.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-messages',
  standalone:true,
  imports:[CommonSvgIconComponent,RouterModule],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss']
})

export class MessagesComponent {

  public isShow : boolean = false;

}
