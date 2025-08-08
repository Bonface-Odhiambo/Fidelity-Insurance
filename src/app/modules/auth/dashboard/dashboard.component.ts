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
// FIX: Import the new, separate payment modal component from its correct path
import { MpesaPaymentModalComponent, PaymentResult } from '../shared/components/payment-modal.component';

// --- TYPE DEFINITIONS ---
type UserRole = 'individual' | 'corporate' | 'intermediary';
interface User { id: string; name: string; email: string; phoneNumber: string; role: UserRole; }
interface Quote { id: string; type: 'marine' | 'travel' | 'golfers'; title: string; amount: number; status: 'pending'; createdDate: Date; expiryDate: Date; description: string; quoteDetails: any; }
interface Claim { id: string; policyNumber: string; title: string; status: 'Pending Review' | 'Approved' | 'Rejected'; claimDate: Date; }
interface Policy {
  id: string; type: 'marine' | 'travel' | 'golfers'; title: string; policyNumber: string; status: 'active'; premium: number; startDate: Date; endDate: Date; certificateUrl?: string;
  marineDetails?: any; golfersDetails?: any; travelDetails?: any;
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
  notifications: Notification[] = [ { id: 'N001', title: 'Quote Awaiting Payment', message: 'Your Marine Cargo quote is about to expire. Complete payment to activate.', timestamp: new Date(), read: false, actionUrl: '#pending-quotes' }, { id: 'N002', title: 'Claim Update', message: 'Your claim #CLM-001 has been approved.', timestamp: new Date(Date.now() - 86400000), read: true, actionUrl: '#claims' } ];
  pendingQuotes: Quote[] = [
    { id: 'Q001', type: 'marine', title: 'Marine Cargo - Machinery', amount: 18500, status: 'pending', createdDate: new Date(new Date().setDate(new Date().getDate() - 5)), expiryDate: new Date(new Date().setDate(new Date().getDate() + 9)), description: 'For heavy machinery shipment from Germany to Mombasa.', quoteDetails: { cargoType: 'containerized', tradeType: 'import', modeOfShipment: 'sea', marineProduct: 'Institute Cargo Clauses (A)', marineCargoType: 'Machinery', origin: 'Germany', destination: 'Mombasa, Kenya', sumInsured: 3500000, descriptionOfGoods: 'Industrial-grade printing press machine.', ucrNumber: 'UCR202408153', idfNumber: 'E2300012345', clientInfo: { name: 'Bonface Odhiambo', idNumber: '30123456', kraPin: 'A001234567Z', email: 'bonface@example.com', phoneNumber: '0712345678' } } },
    { id: 'Q002', type: 'golfers', title: 'Golfers Insurance - Option B', amount: 7500, status: 'pending', createdDate: new Date(new Date().setDate(new Date().getDate() - 1)), expiryDate: new Date(new Date().setDate(new Date().getDate() + 13)), description: 'Annual golfers cover for personal equipment and liability.', quoteDetails: { fullName: 'Bonface Odhiambo', golfClub: 'Karen Country Club', coverOption: 'Option B' } },
    { id: 'Q003', type: 'travel', title: 'Schengen Visa Travel Insurance', amount: 4800, status: 'pending', createdDate: new Date(new Date().setDate(new Date().getDate() - 2)), expiryDate: new Date(new Date().setDate(new Date().getDate() + 12)), description: 'Annual multi-trip coverage for Europe.', quoteDetails: { destination: 'Schengen Area', tripType: 'Annual Multi-trip', duration: '365 Days' } }
  ];
  activePolicies: Policy[] = [];
  claims: Claim[] = [ { id: 'CLM001', policyNumber: 'TRV/2023/1234', title: 'Lost Luggage Claim', status: 'Approved', claimDate: new Date(new Date().setDate(new Date().getDate() - 20)) } ];
  recentActivities: Activity[] = [ { id: 'A003', title: 'Profile Updated', description: 'Contact information updated', timestamp: new Date(Date.now() - 86400000), icon: 'person', iconColor: '#B8D87A' } ];
  isMobileSidebarOpen = false; expandedPolicyId: string | null = null;
  
  constructor(private dialog: MatDialog, public router: Router, private snackBar: MatSnackBar) {}
  
  ngOnInit(): void { this.loadDashboardData(); this.setupNavigationBasedOnRole(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
  
  initiatePayment(quoteId: string): void {
    const quote = this.pendingQuotes.find((q) => q.id === quoteId);
    if (!quote) return;
    const paymentData: MpesaPayment = { amount: quote.amount, phoneNumber: this.user.phoneNumber, reference: `FID-${quote.id}`, description: quote.title };
    const dialogRef = this.dialog.open(MpesaPaymentModalComponent, { data: paymentData, panelClass: 'payment-dialog-container', autoFocus: false });
    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: PaymentResult | null) => {
        if (result?.success) { this.convertQuoteToPolicy(quote); this.snackBar.open(`Payment for "${quote.title}" was successful.`, 'OK', { duration: 7000, panelClass: 'fidelity-toast-panel' }); }
    });
  }

  private convertQuoteToPolicy(quote: Quote): void {
    const newPolicy: Policy = { id: `P${Date.now()}`, type: quote.type, title: quote.title, policyNumber: `${quote.type.toUpperCase().substring(0,3)}/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`, status: 'active', premium: quote.amount, startDate: new Date(), endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), certificateUrl: `/simulated/${quote.type}-policy.pdf` };
    switch(quote.type) {
        case 'marine': newPolicy.marineDetails = quote.quoteDetails; break;
        case 'golfers': newPolicy.golfersDetails = quote.quoteDetails; break;
        case 'travel': newPolicy.travelDetails = quote.quoteDetails; break;
    }
    this.activePolicies.unshift(newPolicy);
    this.pendingQuotes = this.pendingQuotes.filter(q => q.id !== quote.id);
    this.addActivityLog({ id: `A${Date.now()}`, title: 'Payment Successful', description: `Policy Activated: ${newPolicy.policyNumber}`, timestamp: new Date(), icon: 'check_circle', iconColor: '#037B7C' });
    this.loadDashboardData();
  }
  
  private addActivityLog(activity: Activity): void { this.recentActivities.unshift(activity); if (this.recentActivities.length > 5) { this.recentActivities.pop(); } }
  @HostListener('window:resize', ['$event']) onResize(event: Event) { if ((event.target as Window).innerWidth >= 1024) { this.isMobileSidebarOpen = false; } }
  togglePolicyDetails(policyId: string): void { this.expandedPolicyId = this.expandedPolicyId === policyId ? null : policyId; }
  getInitials(name: string): string { return name.split(' ').map((n) => n[0]).join('').substring(0, 2); }
  getUnreadNotificationCount(): number { return this.notifications.filter((n) => !n.read).length; }
  toggleNavItem(item: NavigationItem): void { if (item.children) item.isExpanded = !item.isExpanded; }
  toggleMobileSidebar(): void { this.isMobileSidebarOpen = !this.isMobileSidebarOpen; }
  editQuoteByType(quoteId: string, type: 'marine' | 'travel' | 'golfers'): void { const route = type === 'marine' ? '/sign-up/marine-quote' : type === 'golfers' ? '/golfers-quote' : '/sign-up/travel-quote'; this.router.navigate([route], { queryParams: { editId: quoteId } }); }
  downloadCertificate(policyId: string): void { const policy = this.activePolicies.find((p) => p.id === policyId); if (policy?.certificateUrl) { const link = document.createElement('a'); link.href = policy.certificateUrl; link.download = `${policy.policyNumber}-certificate.pdf`; link.click(); this.snackBar.open(`Downloading certificate for ${policy.policyNumber}`, 'OK', { duration: 3000, panelClass: 'fidelity-toast-panel' }); } }
  
  setupNavigationBasedOnRole(): void {
    this.navigationItems = [
      { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
      { label: 'New Quote', icon: 'add_circle', isExpanded: false, children: [ { label: 'Marine Insurance', route: '/sign-up/marine-quote', icon: 'directions_boat' }, { label: 'Golfers Insurance', route: '/golfers-quote', icon: 'golf_course' }, { label: 'Travel Insurance', route: '/sign-up/travel-quote', icon: 'flight' } ] },
      { label: 'My Policies', icon: 'shield', route: '/policies' },
      { label: 'Claims', icon: 'gavel', route: '/claims', badge: this.claims.filter(c => c.status === 'Pending Review').length },
      { label: 'Receipts', icon: 'receipt_long', route: '/receipts' }
    ];
  }

  loadDashboardData(): void { this.dashboardStats = { activePolicies: this.activePolicies.length, pendingQuotes: this.pendingQuotes.length, openClaims: this.claims.filter(c => c.status === 'Pending Review').length, totalPremium: this.activePolicies.reduce((sum, p) => sum + p.premium, 0) }; }
  logout(): void { if (confirm('Are you sure you want to logout?')) { this.router.navigate(['/']); } }
}