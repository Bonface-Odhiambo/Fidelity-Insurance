import { Routes } from '@angular/router';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { GolfersQuoteComponent } from '../golfers-quote/golfers-quote.component';
import { TravelQuoteComponent } from '../travel-quote/travel-quote.component';
import { PersonalAccidentQuoteComponent } from '../personal-accident-quote/personal-accident-quote.component';
// CORRECTED: Import the component from its actual file
import { MarineCargoQuotationComponent } from '../user-registration/user-registration.component';

// CORRECTED: Import the main sign-up component
import { FidelityAuthSignUpComponent } from './sign-up.component'; // Assuming this file is inside /auth

// I have removed the confusing 'UserRegistrationComponent' import as it seemed to be a duplicate.
// If it's a different component, you need to import it from its correct file.

export default [
    {
    path: 'personal-accident-quote',
    component: PersonalAccidentQuoteComponent

    },
    {
        path: '', // The base path for this module should be the sign-up form
        component: FidelityAuthSignUpComponent,
    },
    {
        path: 'golfers-quote',
        component: GolfersQuoteComponent,
    },
    {
        path: 'marine-quote',
        component: MarineCargoQuotationComponent, // This seems to be the user registration/quotation form
    },
    {
        path: 'dashboard',
        component: DashboardComponent,
    },
    {
        path: 'travel-quote',
        component: TravelQuoteComponent,
    },
    
] as Routes;
