// src/app/modules/auth/personal-accident-quote/personal-accident-quote.routes.ts
import { Routes } from '@angular/router';
import { PersonalAccidentQuoteComponent } from './personal-accident-quote.component';

export const routes: Routes = [ // Changed from personalAccidentQuoteRoutes
  {
    path: '', // The component will be loaded when navigating to /personal-accident-quote
    component: PersonalAccidentQuoteComponent,
  },
];