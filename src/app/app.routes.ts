import { Route } from '@angular/router';
import { initialDataResolver } from 'app/app.resolvers';
import { NoAuthGuard } from 'app/core/auth/guards/noAuth.guard';
import { LayoutComponent } from 'app/layout/layout.component';
import { DashboardComponent } from './modules/auth/dashboard/dashboard.component';
import { FidelityAuthSignUpComponent } from './modules/auth/home/sign-up.component';

// @formatter:off
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
export const appRoutes: Route[] = [

    // Top-level route for golfers-quote (as it was)
    {
        path: 'golfers-quote',
        loadChildren: () => import('app/modules/auth/golfers-quote/golfers-quote.routes').then(m => m.routes),
    },

    // NEW PARENT ROUTE FOR SIGN-UP to handle children like personal-accident
    {
        path: 'sign-up',
        children: [
            {
                // This path handles the base 'sign-up' URL
                path: '',
                loadChildren: () => import('app/modules/auth/home/sign-up.routes'),
            },
            {
                // This path handles 'sign-up/personal-accident-quote'
                path: 'personal-accident-quote',
                loadChildren: () => import('app/modules/auth/personal-accident-quote/personal-accident-quote.routes').then(m => m.routes),
            },
            // You can add other child routes like 'sign-up/marine' here in the future
        ]
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
            // The 'sign-up' route is now defined as a parent route at the top level,
            // so we REMOVE the old one from here to avoid conflicts.
            // {
            //     path: 'sign-up',
            //     loadChildren: () =>
            //         import('app/modules/auth/home/sign-up.routes'),
            // },
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