import { CommonModule } from '@angular/common';
import { Component, HostListener, Inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MatTabsModule } from '@angular/material/tabs';

// --- TYPE DEFINITIONS ---
type UserRole = 'individual' | 'corporate' | 'intermediary';
interface User { id: string; name: string; email: string; phoneNumber: string; role: UserRole; }
interface Quote { id: string; type: 'marine' | 'travel'; title: string; amount: number; status: 'draft' | 'pending' | 'completed' | 'expired'; createdDate: Date; expiryDate: Date; description: string; }
interface Policy {
  id: string; type: 'marine' | 'travel'; title: string; policyNumber: string; status: 'active' | 'completed'; premium: number; startDate: Date; endDate: Date; certificateUrl?: string;
  marineDetails?: { cargoType: 'containerized' | 'non-containerized'; tradeType: 'import' | 'export'; modeOfShipment: 'sea' | 'air'; marineProduct: string; marineCargoType: string; origin: string; destination: string; sumInsured: number; descriptionOfGoods: string; ucrNumber: string; idfNumber: string; clientInfo: { name: string; idNumber: string; kraPin: string; email: string; phoneNumber: string; } }
}
interface DashboardStats { marinePolicies: number; travelPolicies: number; pendingQuotes: number; totalPremium: number; }
interface MpesaPayment { amount: number; phoneNumber: string; reference: string; description: string; }
interface NavigationItem { label: string; icon: string; route?: string; children?: NavigationItem[]; badge?: number; isExpanded?: boolean; }
interface Notification { id: string; title: string; message: string; timestamp: Date; read: boolean; actionUrl?: string; }
interface Activity { id: string; title: string; description: string; timestamp: Date; icon: string; iconColor: string; amount?: number; relatedId?: string; }
export interface PaymentResult { success: boolean; method: 'stk' | 'paybill' | 'card'; reference: string; mpesaReceipt?: string; }

// --- EMBEDDED PAYMENT MODAL COMPONENT ---
@Component({
  selector: 'app-mpesa-payment-modal',
  standalone: true,
  imports: [ CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, MatProgressSpinnerModule, MatTabsModule ],
  template: `<div class="payment-modal-container"><div class="modal-header"><div class="header-icon-wrapper"><mat-icon>payment</mat-icon></div><div><h1 mat-dialog-title class="modal-title">Complete Your Payment</h1><p class="modal-subtitle">Pay KES {{ data.amount | number: '1.2-2' }} for {{ data.description }}</p></div><button mat-icon-button (click)="closeDialog()" class="close-button" aria-label="Close dialog"><mat-icon>close</mat-icon></button></div><mat-dialog-content class="modal-content"><mat-tab-group (selectedTabChange)="selectedPaymentMethod = $event.index === 0 ? 'mpesa' : 'card'" animationDuration="300ms" mat-stretch-tabs="true" class="payment-tabs"><mat-tab><ng-template mat-tab-label><div class="tab-label-content"><mat-icon>phone_iphone</mat-icon><span>M-PESA</span></div></ng-template><div class="tab-panel-content"><div class="sub-options"><button (click)="mpesaSubMethod = 'stk'" class="sub-option-btn" [class.active]="mpesaSubMethod === 'stk'"><mat-icon>tap_and_play</mat-icon><span>STK Push</span></button><button (click)="mpesaSubMethod = 'paybill'" class="sub-option-btn" [class.active]="mpesaSubMethod === 'paybill'"><mat-icon>article</mat-icon><span>Use Paybill</span></button></div><div *ngIf="mpesaSubMethod === 'stk'" class="option-view animate-fade-in"><p class="instruction-text">Enter your M-PESA phone number to receive a payment prompt.</p><form [formGroup]="stkForm"><mat-form-field appearance="outline"><mat-label>Phone Number</mat-label><input matInput formControlName="phoneNumber" placeholder="e.g., 0712345678" [disabled]="isProcessingStk"><mat-icon matSuffix>phone_iphone</mat-icon></mat-form-field></form><button mat-raised-button class="action-button" (click)="processStkPush()" [disabled]="stkForm.invalid || isProcessingStk"><mat-spinner *ngIf="isProcessingStk" diameter="24"></mat-spinner><span *ngIf="!isProcessingStk">Pay KES {{ data.amount | number: '1.0-0' }}</span></button></div><div *ngIf="mpesaSubMethod === 'paybill'" class="option-view animate-fade-in"><p class="instruction-text">Use the details below on your M-PESA App to complete payment.</p><div class="paybill-details"><div class="detail-item"><span class="label">Paybill Number:</span><span class="value">853338</span></div><div class="detail-item"><span class="label">Account Number:</span><span class="value account-number">{{ data.reference }}</span></div></div><button mat-raised-button class="action-button" (click)="verifyPaybillPayment()" [disabled]="isVerifyingPaybill"><mat-spinner *ngIf="isVerifyingPaybill" diameter="24"></mat-spinner><span *ngIf="!isVerifyingPaybill">Verify Payment</span></button></div></div></mat-tab><mat-tab><ng-template mat-tab-label><div class="tab-label-content"><mat-icon>credit_card</mat-icon><span>Credit/Debit Card</span></div></ng-template><div class="tab-panel-content animate-fade-in"><div class="card-redirect-info"><p class="instruction-text">You will be redirected to pay via <strong>I&M Bank</strong>, our reliable and trusted payment partner.</p><button mat-raised-button class="action-button" (click)="redirectToCardGateway()" [disabled]="isRedirectingToCard"><mat-spinner *ngIf="isRedirectingToCard" diameter="24"></mat-spinner><span *ngIf="!isRedirectingToCard">Pay Using Credit/Debit Card</span></button></div></div></mat-tab></mat-tab-group></mat-dialog-content></div>`,
  // UPDATED: Using Fidelity Brand Colors
  styles: [`:host { --fidelity-turquoise: #037B7C; --fidelity-lime: #B8D87A; --white-color: #ffffff; --light-gray: #f8f9fa; --medium-gray: #e9ecef; --dark-gray: #495057; }.payment-modal-container { background-color: var(--white-color); border-radius: 16px; overflow: hidden; max-width: 450px; }.modal-header { display: flex; align-items: center; padding: 20px 24px; background-color: var(--fidelity-turquoise); color: var(--white-color); position: relative; }.header-icon-wrapper { width: 48px; height: 48px; background-color: rgba(255, 255, 255, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 16px; flex-shrink: 0; }.header-icon-wrapper mat-icon { color: var(--fidelity-lime); font-size: 28px; width: 28px; height: 28px; }.modal-title { font-size: 22px; font-weight: 700; margin: 0; color: var(--white-color); text-shadow: 0 1px 2px rgba(0,0,0,0.2); }.modal-subtitle { font-size: 14px; opacity: 0.8; margin-top: 4px; color: var(--white-color); }.close-button { position: absolute; top: 12px; right: 12px; color: var(--white-color); }.modal-content { padding: 0 !important; }.payment-tabs .tab-label-content { display: flex; align-items: center; gap: 8px; height: 60px; }.tab-panel-content { padding: 24px; }.sub-options { display: flex; gap: 12px; margin-bottom: 24px; border: 1px solid var(--medium-gray); border-radius: 12px; padding: 6px; background-color: var(--light-gray); }.sub-option-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 8px; border: none; background-color: transparent; font-weight: 600; cursor: pointer; transition: all 0.2s; color: var(--dark-gray); }.sub-option-btn.active { background-color: var(--white-color); color: var(--fidelity-turquoise); box-shadow: 0 2px 4px rgba(0,0,0,0.05) }.instruction-text { text-align: center; color: var(--dark-gray); font-size: 15px; margin-bottom: 20px; }mat-form-field { width: 100%; }.action-button { width: 100%; height: 52px; border-radius: 12px; background-color: var(--fidelity-turquoise) !important; color: var(--white-color) !important; font-size: 16px; font-weight: 700; }.action-button:disabled { background-color: #a0a3c2 !important; color: rgba(255, 255, 255, 0.7) !important; }.paybill-details { background: var(--light-gray); border: 1px dashed var(--medium-gray); border-radius: 12px; padding: 20px; margin-bottom: 24px; }.detail-item { display: flex; justify-content: space-between; align-items: center; font-size: 16px; padding: 12px 0; }.detail-item + .detail-item { border-top: 1px solid var(--medium-gray); }.detail-item .label { color: var(--dark-gray); }.detail-item .value { font-weight: 700; }.detail-item .account-number { font-family: 'Courier New', monospace; background-color: var(--medium-gray); padding: 4px 8px; border-radius: 6px; }.card-redirect-info { text-align: center; }.animate-fade-in { animation: fadeIn 0.4s ease-in-out; }@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }::ng-deep .payment-tabs .mat-mdc-tab-header { --mat-tab-header-inactive-ripple-color: rgba(3, 123, 124, 0.1); --mat-tab-header-active-ripple-color: rgba(3, 123, 124, 0.2); }::ng-deep .payment-tabs .mdc-tab__text-label { color: var(--dark-gray); font-weight: 600; }::ng-deep .payment-tabs .mat-mdc-tab.mat-mdc-tab-active .mdc-tab__text-label { color: var(--fidelity-turquoise); }::ng-deep .payment-tabs .mat-mdc-tab-indicator-bar { background-color: var(--fidelity-turquoise) !important; }`]
})
export class MpesaPaymentModalComponent implements OnInit { stkForm: FormGroup; selectedPaymentMethod: 'mpesa' | 'card' = 'mpesa'; mpesaSubMethod: 'stk' | 'paybill' = 'stk'; isProcessingStk = false; isVerifyingPaybill = false; isRedirectingToCard = false; constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<MpesaPaymentModalComponent>, @Inject(MAT_DIALOG_DATA) public data: MpesaPayment) { this.stkForm = this.fb.group({ phoneNumber: [data.phoneNumber || '', [Validators.required, Validators.pattern(/^(07|01)\d{8}$/)]], }); } ngOnInit(): void {} closeDialog(result: PaymentResult | null = null): void { this.dialogRef.close(result); } processStkPush(): void { if (this.stkForm.invalid) return; this.isProcessingStk = true; setTimeout(() => { this.isProcessingStk = false; this.closeDialog({ success: true, method: 'stk', reference: this.data.reference, mpesaReceipt: 'S' + Math.random().toString(36).substring(2, 12).toUpperCase() }); }, 3000); } verifyPaybillPayment(): void { this.isVerifyingPaybill = true; setTimeout(() => { this.isVerifyingPaybill = false; this.closeDialog({ success: true, method: 'paybill', reference: this.data.reference }); }, 3500); } redirectToCardGateway(): void { this.isRedirectingToCard = true; setTimeout(() => { this.isRedirectingToCard = false; console.log('Redirecting to I&M Bank payment gateway...'); this.closeDialog({ success: true, method: 'card', reference: this.data.reference }); }, 2000); } }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ CommonModule, RouterModule, MatIconModule, MatButtonModule, MatMenuModule, MatDividerModule, MatChipsModule, MatCardModule, MatDialogModule, MatBadgeModule, MatSnackBarModule, MpesaPaymentModalComponent ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  navigationItems: NavigationItem[] = [];
  user: User = { id: 'U001', name: 'Bonface Odhiambo', email: 'bonface@example.com', phoneNumber: '0712345678', role: 'individual' };
  dashboardStats: DashboardStats = { marinePolicies: 0, travelPolicies: 0, pendingQuotes: 0, totalPremium: 0 };
  notifications: Notification[] = [ { id: 'N001', title: 'Quotes Awaiting Payment', message: 'You have quotes that need payment to activate your policy.', timestamp: new Date(), read: false, actionUrl: '#pending-quotes' }, { id: 'N002', title: 'Certificates Ready', message: 'Your new policy certificates are ready for download.', timestamp: new Date(), read: false, actionUrl: '#active-policies' } ];
  savedQuotes: Quote[] = [ { id: 'Q001', type: 'marine', title: 'Marine Cargo Insurance - Machinery', amount: 18500, status: 'pending', createdDate: new Date(new Date().setDate(new Date().getDate() - 5)), expiryDate: new Date(new Date().setDate(new Date().getDate() + 9)), description: 'For heavy machinery shipment from Germany.' }, { id: 'Q003', type: 'travel', title: 'Schengen Visa Travel Insurance', amount: 4800, status: 'pending', createdDate: new Date(new Date().setDate(new Date().getDate() - 2)), expiryDate: new Date(new Date().setDate(new Date().getDate() + 12)), description: 'Annual multi-trip coverage for Europe.' }];
  activePolicies: Policy[] = [ { id: 'P001', type: 'marine', title: 'Machinery Import', policyNumber: 'MAR/2024/7531', status: 'active', premium: 18500, startDate: new Date('2024-08-01'), endDate: new Date('2024-09-30'), certificateUrl: '/simulated/MAR-2024-7531.pdf', marineDetails: { cargoType: 'containerized', tradeType: 'import', modeOfShipment: 'sea', marineProduct: 'Institute Cargo Clauses (A) - All Risks', marineCargoType: 'Machinery', origin: 'Germany', destination: 'Mombasa, Kenya', sumInsured: 3500000, descriptionOfGoods: 'Industrial-grade printing press machine, packed in a 40ft container.', ucrNumber: 'UCR202408153', idfNumber: 'E2300012345', clientInfo: { name: 'Bonface Odhiambo', idNumber: '30123456', kraPin: 'A001234567Z', email: 'bonface@example.com', phoneNumber: '0712345678' } } }, { id: 'P002', type: 'travel', title: 'Schengen Visa Travel Insurance', policyNumber: 'TRV/2024/9102', status: 'active', premium: 4800, startDate: new Date('2024-09-01'), endDate: new Date('2025-08-31'), certificateUrl: '/simulated/TRV-2024-9102.pdf' } ];
  // UPDATED: Using Fidelity Brand Colors for dynamic elements
  recentActivities: Activity[] = [
    { id: 'A001', title: 'Payment Successful', description: 'Travel Insurance for Europe', timestamp: new Date(Date.now() - 3600000), icon: 'payment', iconColor: '#037B7C', relatedId: 'P003' },
    { id: 'A002', title: 'Certificate Downloaded', description: 'Marine Cargo Policy MAR-2025-002', timestamp: new Date(Date.now() - 14400000), icon: 'download', iconColor: '#037B7C', relatedId: 'P002' },
    { id: 'A003', title: 'Profile Updated', description: 'Contact information updated', timestamp: new Date(Date.now() - 86400000), icon: 'person', iconColor: '#B8D87A' }
  ];
  isMobileSidebarOpen = false; expandedPolicyId: string | null = null;
  
  constructor(private dialog: MatDialog, public router: Router, private snackBar: MatSnackBar) {}
  
  ngOnInit(): void { 
    this.loadDashboardData(); 
    this.setupNavigationBasedOnRole(); 
  }
  
  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    if ((event.target as Window).innerWidth >= 1024) {
      this.isMobileSidebarOpen = false;
    }
  }
  
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
  initiatePayment(quoteId: string): void { const quote = this.savedQuotes.find((q) => q.id === quoteId); if (quote) { const paymentReference = `FID${new Date().getFullYear()}${quote.id}`; const paymentData: MpesaPayment = { amount: quote.amount, phoneNumber: this.user.phoneNumber, reference: paymentReference, description: quote.title }; this.openPaymentModal(paymentData); } }
  private openPaymentModal(paymentData: MpesaPayment): void { const dialogRef = this.dialog.open(MpesaPaymentModalComponent, { data: paymentData, panelClass: 'payment-modal-panel', autoFocus: false }); dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: PaymentResult | null) => { if (result?.success) { const quote = this.savedQuotes.find((q) => result.reference.includes(q.id)); if (!quote) return; quote.status = 'completed'; this.loadDashboardData(); if (result.method === 'paybill') { this.showDownloadToast(); setTimeout(() => this.activateAndDownloadPolicy(quote.id), 1000); } else { this.snackBar.open(`Payment for "${quote.title}" was successful.`, 'OK', { duration: 7000, panelClass: 'fidelity-toast-panel' }); } } }); }
  private showDownloadToast(): void { this.snackBar.open('Your insurance policy is being downloaded...', 'OK', { duration: 5000, panelClass: ['fidelity-toast-panel'] }); }
  private activateAndDownloadPolicy(quoteId: string): void { const policy = this.activePolicies[0]; this.downloadCertificate(policy.id); }
  onLogoError(event: any): void { console.error('Logo failed to load:', event); }
  togglePolicyDetails(policyId: string): void { this.expandedPolicyId = this.expandedPolicyId === policyId ? null : policyId; }
  getInitials(name: string): string { return name.split(' ').map((n) => n[0]).join('').substring(0, 2); }
  getRoleDisplayName(): string { return 'Individual Client'; }
  getUnreadNotificationCount(): number { return this.notifications.filter((n) => !n.read).length; }
  toggleNavItem(item: NavigationItem): void { if (item.children) item.isExpanded = !item.isExpanded; }
  toggleMobileSidebar(): void { this.isMobileSidebarOpen = !this.isMobileSidebarOpen; }
  getPendingQuotes(): Quote[] { return this.savedQuotes.filter(q => q.status === 'pending'); }
  editQuoteByType(quoteId: string, type: 'marine' | 'travel'): void { const route = type === 'marine' ? '/sign-up/marine-quote' : '/sign-up/travel-quote'; this.router.navigate([route], { queryParams: { editId: quoteId } }); }
  downloadCertificate(policyId: string): void { const policy = this.activePolicies.find((p) => p.id === policyId); if (policy?.certificateUrl) { const link = document.createElement('a'); link.href = policy.certificateUrl; link.download = `${policy.policyNumber}-certificate.pdf`; link.click(); } }
  markNotificationAsRead(notification: Notification): void { notification.read = true; if (notification.actionUrl) { document.querySelector(notification.actionUrl)?.scrollIntoView({ behavior: 'smooth' }); } }
  
  setupNavigationBasedOnRole(): void {
    this.navigationItems = [
      { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
      {
        label: 'Marine Insurance', icon: 'directions_boat', isExpanded: true,
        children: [
          { label: 'New Quote', route: '/sign-up/marine-quote', icon: 'add_circle' },
          { label: 'Pending Quotes', route: '/marine/pending', icon: 'pending' }
        ]
      },
      {
        label: 'Travel Insurance', icon: 'flight', isExpanded: false,
        children: [
          { label: 'New Quote', route: '/sign-up/travel-quote', icon: 'add_circle' },
          { label: 'Pending Quotes', route: '/travel/pending', icon: 'pending' }
        ]
      },
      { label: 'My Policies', icon: 'shield', route: '/policies' },
      { label: 'Claims', icon: 'gavel', route: '/claims', badge: 1 },
      { label: 'Receipts', icon: 'receipt_long', route: '/receipts' }
    ];
  }

  loadDashboardData(): void { this.dashboardStats = { marinePolicies: this.activePolicies.filter((p) => p.type === 'marine').length, travelPolicies: this.activePolicies.filter((p) => p.type === 'travel').length, pendingQuotes: this.getPendingQuotes().length, totalPremium: this.activePolicies.reduce((sum, p) => sum + p.premium, 0) }; }
  logout(): void { if (confirm('Are you sure you want to logout?')) { this.router.navigate(['/']); } }
}