import { CommonModule, DatePipe } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MpesaPaymentModalComponent, PaymentResult } from '../shared/components/payment-modal.component';

// --- CONSTANTS FOR LOCAL STORAGE KEYS ---
const TRAVEL_QUOTES_KEY = 'fidelity_pending_quotes';
const GOLFERS_QUOTES_KEY = 'pendingGolfQuotes';

// --- TYPE DEFINITIONS ---
type UserRole = 'individual' | 'corporate' | 'intermediary';
interface User { id: string; name: string; email: string; phoneNumber: string; role: UserRole; }
interface Quote { id: string; type: 'travel' | 'golfers'; title: string; amount: number; expiryDate: Date; description: string; quoteDetails: any; }
interface Claim { id: string; policyNumber: string; title: string; status: 'Pending Review' | 'Approved' | 'Rejected'; claimDate: Date; }
interface Policy {
  id: string; type: 'travel' | 'golfers'; title: string; policyNumber: string; status: 'active'; premium: number; startDate: Date; endDate: Date; certificateUrl?: string;
  golfersDetails?: any; travelDetails?: any;
}
interface DashboardStats { activePolicies: number; pendingQuotes: number; openClaims: number; totalPremium: number; }
interface MpesaPayment { amount: number; phoneNumber: string; reference: string; description: string; }
interface NavigationItem { label: string; icon: string; route?: string; children?: NavigationItem[]; badge?: number; isExpanded?: boolean; }
interface Notification { id: string; title: string; message: string; timestamp: Date; read: boolean; actionUrl?: string; }
interface Activity { id: string; title: string; description: string; timestamp: Date; icon: string; iconColor: string; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ CommonModule, RouterModule, MatIconModule, MatButtonModule, MatMenuModule, MatDividerModule, MatChipsModule, MatCardModule, MatDialogModule, MatBadgeModule, MatSnackBarModule, DatePipe, MpesaPaymentModalComponent ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  navigationItems: NavigationItem[] = [];
  user: User = { id: 'U001', name: 'Bonface Odhiambo', email: 'bonface@example.com', phoneNumber: '0712345678', role: 'individual' };
  dashboardStats: DashboardStats = { activePolicies: 0, pendingQuotes: 0, openClaims: 0, totalPremium: 0 };
  notifications: Notification[] = []; // Start empty, can be populated from a service
  pendingQuotes: Quote[] = []; // Start empty, will be loaded from localStorage
  activePolicies: Policy[] = []; // Start empty
  claims: Claim[] = [ { id: 'CLM001', policyNumber: 'TRV/2023/1234', title: 'Lost Luggage Claim', status: 'Approved', claimDate: new Date(new Date().setDate(new Date().getDate() - 20)) } ];
  recentActivities: Activity[] = [];
  isMobileSidebarOpen = false; 
  expandedPolicyId: string | null = null;
  
  constructor(private dialog: MatDialog, public router: Router, private snackBar: MatSnackBar) {}
  
  ngOnInit(): void { 
    this.loadAllPendingQuotes();
    this.loadDashboardData(); 
    this.setupNavigationBasedOnRole(); 
  }

  ngOnDestroy(): void { 
    this.destroy$.next(); 
    this.destroy$.complete(); 
  }

  loadAllPendingQuotes(): void {
    // Load Travel Quotes
    const rawTravelQuotes = JSON.parse(localStorage.getItem(TRAVEL_QUOTES_KEY) || '[]');
    const mappedTravelQuotes: Quote[] = rawTravelQuotes.map((q: any) => ({
        id: q.id,
        type: 'travel',
        title: q.planDetails.name,
        amount: q.premiumSummary.totalPayableKES,
        expiryDate: new Date(new Date(q.date).getTime() + 14 * 24 * 60 * 60 * 1000), // Expires in 14 days
        description: `${q.planDetails.duration} for ${q.travelerDetails.fullName}`,
        quoteDetails: q
    }));

    // Load Golfers Quotes
    const rawGolfersQuotes = JSON.parse(localStorage.getItem(GOLFERS_QUOTES_KEY) || '[]');
    const mappedGolfersQuotes: Quote[] = rawGolfersQuotes.map((q: any) => ({
        id: q.id,
        type: 'golfers',
        title: `Golfers - ${q.selectedPlan.name}`,
        amount: q.selectedPlan.premium,
        expiryDate: new Date(new Date(q.quoteDate).getTime() + 14 * 24 * 60 * 60 * 1000), // Expires in 14 days
        description: `Annual cover for ${q.formData.golfClub}`,
        quoteDetails: q
    }));

    // Combine and set the quotes
    this.pendingQuotes = [...mappedTravelQuotes, ...mappedGolfersQuotes];
  }
  
  initiatePayment(quoteId: string): void {
    const quote = this.pendingQuotes.find((q) => q.id === quoteId);
    if (!quote) return;

    const phoneNumber = quote.type === 'travel' ? quote.quoteDetails.travelerDetails.phoneNumber : quote.quoteDetails.formData.phoneNumber;
    
    const paymentData: MpesaPayment = { 
        amount: quote.amount, 
        phoneNumber: phoneNumber || this.user.phoneNumber, 
        reference: quote.id, 
        description: quote.title 
    };

    const dialogRef = this.dialog.open(MpesaPaymentModalComponent, { data: paymentData, panelClass: 'payment-modal-panel' });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: PaymentResult | null) => {
        if (result?.success) { 
            this.convertQuoteToPolicy(quote); 
            this.snackBar.open(`Payment for "${quote.title}" was successful.`, 'OK', { duration: 7000, panelClass: 'fidelity-toast-panel' }); 
        }
    });
  }

  private convertQuoteToPolicy(quote: Quote): void {
    // Create a new policy from the quote
    const newPolicy: Policy = { 
        id: `P${Date.now()}`, 
        type: quote.type, 
        title: quote.title, 
        policyNumber: `${quote.type.toUpperCase().substring(0,3)}/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`, 
        status: 'active', 
        premium: quote.amount, 
        startDate: new Date(), 
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 
        certificateUrl: `/simulated/${quote.type}-policy.pdf`,
        golfersDetails: quote.type === 'golfers' ? quote.quoteDetails.formData : null,
        travelDetails: quote.type === 'travel' ? quote.quoteDetails.planDetails : null,
    };

    this.activePolicies.unshift(newPolicy);

    // Remove the quote from the correct localStorage
    const key = quote.type === 'travel' ? TRAVEL_QUOTES_KEY : GOLFERS_QUOTES_KEY;
    const allQuotesFromStorage = JSON.parse(localStorage.getItem(key) || '[]');
    const updatedQuotes = allQuotesFromStorage.filter((q: any) => q.id !== quote.id);
    localStorage.setItem(key, JSON.stringify(updatedQuotes));

    // Refresh dashboard data
    this.addActivityLog({ id: `A${Date.now()}`, title: 'Payment Successful', description: `Policy Activated: ${newPolicy.policyNumber}`, timestamp: new Date(), icon: 'check_circle', iconColor: '#037B7C' });
    this.loadAllPendingQuotes(); // Reload quotes from storage
    this.loadDashboardData(); // Recalculate stats
  }
  
  private addActivityLog(activity: Activity): void { this.recentActivities.unshift(activity); if (this.recentActivities.length > 5) { this.recentActivities.pop(); } }
  
  @HostListener('window:resize', ['$event']) 
  onResize(event: Event) { if ((event.target as Window).innerWidth >= 1024) { this.isMobileSidebarOpen = false; } }
  
  togglePolicyDetails(policyId: string): void { this.expandedPolicyId = this.expandedPolicyId === policyId ? null : policyId; }
  getInitials(name: string): string { return name.split(' ').map((n) => n[0]).join('').substring(0, 2); }
  getUnreadNotificationCount(): number { return this.notifications.filter((n) => !n.read).length; }
  toggleNavItem(item: NavigationItem): void { if (item.children) item.isExpanded = !item.isExpanded; }
  toggleMobileSidebar(): void { this.isMobileSidebarOpen = !this.isMobileSidebarOpen; }
  editQuoteByType(quoteId: string, type: 'travel' | 'golfers'): void { } // Placeholder for edit logic
  downloadCertificate(policyId: string): void { } // Placeholder for download logic
  
  setupNavigationBasedOnRole(): void {
    this.navigationItems = [
      { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
      { label: 'New Quote', icon: 'add_circle', isExpanded: true, children: [ { label: 'Travel Insurance', route: '/travel-quote', icon: 'flight' }, { label: 'Golfers Insurance', route: '/golfers-quote', icon: 'golf_course' } ] },
      { label: 'My Policies', icon: 'shield', route: '/policies' },
      { label: 'Claims', icon: 'gavel', route: '/claims', badge: this.claims.filter(c => c.status === 'Pending Review').length },
      { label: 'Receipts', icon: 'receipt_long', route: '/receipts' }
    ];
  }

  loadDashboardData(): void { 
      this.dashboardStats = { 
          activePolicies: this.activePolicies.length, 
          pendingQuotes: this.pendingQuotes.length, 
          openClaims: this.claims.filter(c => c.status === 'Pending Review').length, 
          totalPremium: this.activePolicies.reduce((sum, p) => sum + p.premium, 0) 
      }; 
  }
  
  logout(): void { if (confirm('Are you sure you want to logout?')) { this.router.navigate(['/']); } }
}