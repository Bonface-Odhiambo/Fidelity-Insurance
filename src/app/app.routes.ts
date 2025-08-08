import { Route } from '@angular/router';
import { initialDataResolver } from 'app/app.resolvers';
import { NoAuthGuard } from 'app/core/auth/guards/noAuth.guard';
import { LayoutComponent } from 'app/layout/layout.component';
// We no longer import components directly here for the golfers quote page
// import { GolfersQuoteComponent } from './modules/auth/golfers-quote/golfer-quote.component';
import { DashboardComponent } from './modules/auth/dashboard/dashboard.component';
import { FidelityAuthSignUpComponent } from './modules/auth/home/sign-up.component';

// @formatter:off
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
export const appRoutes: Route[] = [

    // ADD THE NEW GOLFERS QUOTE ROUTE HERE
    // This is a top-level route. It is lazy-loaded and does NOT use the LayoutComponent.
    // This is why it will render as a full page and not be blank.
    {
        path: 'golfers-quote',
        loadChildren: () => import('app/modules/auth/golfers-quote/golfers-quote.routes').then(m => m.routes),
    },
    
    // Root route without layout
    {
        path: '',
        pathMatch: 'full',
        component: FidelityAuthSignUpComponent,
    },

    // Redirect signed-in user to the '/example'
    { path: 'signed-in-redirect', pathMatch: 'full', redirectTo: 'example' },

    // Auth routes for guests
    {
        path: '',
        canActivate: [NoAuthGuard],
        canActivateChild: [NoAuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty',
        },
        children: [
            {
                path: 'confirmation-required',
                loadChildren: () =>
                    import(
                        'app/modules/auth/confirmation-required/confirmation-required.routes'
                    ),
            },
            {
                path: 'forgot-password',
                loadChildren: () =>
                    import(
                        'app/modules/auth/forgot-password/forgot-password.routes'
                    ),
            },
            {
                path: 'reset-password',
                loadChildren: () =>
                    import(
                        'app/modules/auth/reset-password/reset-password.routes'
                    ),
            },
            {
                path: 'sign-in',
                loadChildren: () =>
                    import('app/modules/auth/sign-in/sign-in.routes'),
            },
            {
                path: 'dashboard',
                component: DashboardComponent,
            },
            // REMOVED THE OLD GOLFERS QUOTE ROUTE
            {
                path: 'sign-up',
                loadChildren: () =>
                    import('app/modules/auth/home/sign-up.routes'),
            },
        ],
    },

    // Auth routes for authenticated users
    {
        path: '',
        canActivate: [],
        canActivateChild: [],
        component: LayoutComponent,
        data: {
            layout: 'empty',
        },
        children: [
            {
                path: 'sign-out',
                loadChildren: () =>
                    import('app/modules/auth/sign-out/sign-out.routes'),
            },
            {
                path: 'unlock-session',
                loadChildren: () =>
                    import(
                        'app/modules/auth/unlock-session/unlock-session.routes'
                    ),
            },
        ],
    },

    // Landing routes
    {
        path: '',
        component: LayoutComponent,
        data: {
            layout: 'empty',
        },
        children: [
            {
                path: 'home',
                loadChildren: () =>
                    import('app/modules/landing/home/home.routes'),
            },
        ],
    },

    // Admin routes
    {
        path: '',
        canActivate: [],
        canActivateChild: [],
        component: LayoutComponent,
        resolve: {
            initialData: initialDataResolver,
        },
        children: [
            {
                path: 'example',
                loadChildren: () =>
                    import('app/modules/admin/example/example.routes'),
            },
        ],
    },
];