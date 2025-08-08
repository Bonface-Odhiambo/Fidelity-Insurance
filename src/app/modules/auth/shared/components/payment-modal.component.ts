// src/app/modules/auth/shared/components/payment-modal.component.ts

import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';

// --- INTERFACES ---
interface MpesaPayment { amount: number; phoneNumber: string; reference: string; description: string; }
export interface PaymentResult { success: boolean; method: 'stk' | 'paybill' | 'card'; reference: string; mpesaReceipt?: string; }

@Component({
  selector: 'app-mpesa-payment-modal',
  standalone: true,
  imports: [ CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, MatProgressSpinnerModule, MatTabsModule, CurrencyPipe ],
  template: `
    <div class="payment-modal-container">
        <div class="modal-header">
            <div class="header-icon-wrapper"><mat-icon>payment</mat-icon></div>
            <div>
                <h1 mat-dialog-title class="modal-title">Complete Your Payment</h1>
                <p class="modal-subtitle">Pay KES {{ data.amount | number: '1.2-2' }} for {{ data.description }}</p>
            </div>
            <button mat-icon-button (click)="closeDialog()" class="close-button" aria-label="Close dialog"><mat-icon>close</mat-icon></button>
        </div>
        <mat-dialog-content class="modal-content">
            <mat-tab-group animationDuration="300ms" mat-stretch-tabs="true" class="payment-tabs">
                <mat-tab>
                    <ng-template mat-tab-label><div class="tab-label-content"><mat-icon>phone_iphone</mat-icon><span>M-PESA</span></div></ng-template>
                    <div class="tab-panel-content">
                        <div class="sub-options">
                            <button (click)="mpesaSubMethod = 'stk'" class="sub-option-btn" [class.active]="mpesaSubMethod === 'stk'"><mat-icon>tap_and_play</mat-icon><span>STK Push</span></button>
                            <button (click)="mpesaSubMethod = 'paybill'" class="sub-option-btn" [class.active]="mpesaSubMethod === 'paybill'"><mat-icon>article</mat-icon><span>Use Paybill</span></button>
                        </div>
                        <div *ngIf="mpesaSubMethod === 'stk'" class="option-view animate-fade-in">
                            <p class="instruction-text">Enter your M-PESA phone number to receive a payment prompt.</p>
                            <form [formGroup]="stkForm">
                                <mat-form-field appearance="outline">
                                    <mat-label>Phone Number</mat-label>
                                    <input matInput formControlName="phoneNumber" placeholder="e.g., 0712345678" [disabled]="isProcessingStk"/>
                                    <mat-icon matSuffix>phone_iphone</mat-icon>
                                </mat-form-field>
                            </form>
                            <button mat-raised-button class="action-button" (click)="processStkPush()" [disabled]="stkForm.invalid || isProcessingStk">
                                <mat-spinner *ngIf="isProcessingStk" diameter="24"></mat-spinner>
                                <span *ngIf="!isProcessingStk">Pay KES {{ data.amount | number: '1.2-2' }}</span>
                            </button>
                        </div>
                        <div *ngIf="mpesaSubMethod === 'paybill'" class="option-view animate-fade-in">
                            <p class="instruction-text">Use the details below on your M-PESA App to complete payment.</p>
                            <div class="paybill-details"><div class="detail-item"><span class="label">Paybill Number:</span><span class="value">853338</span></div><div class="detail-item"><span class="label">Account Number:</span><span class="value account-number">{{ data.reference }}</span></div></div>
                            <button mat-raised-button class="action-button" (click)="verifyPaybillPayment()" [disabled]="isVerifyingPaybill"><mat-spinner *ngIf="isVerifyingPaybill" diameter="24"></mat-spinner><span *ngIf="!isVerifyingPaybill">Verify Payment</span></button>
                        </div>
                    </div>
                </mat-tab>
                <mat-tab>
                    <ng-template mat-tab-label><div class="tab-label-content"><mat-icon>credit_card</mat-icon><span>Credit/Debit Card</span></div></ng-template>
                    <div class="tab-panel-content animate-fade-in"><div class="card-redirect-info"><p class="instruction-text">You will be redirected to a secure payment gateway to complete your transaction.</p><button mat-raised-button class="action-button" (click)="redirectToCardGateway()" [disabled]="isRedirectingToCard"><mat-spinner *ngIf="isRedirectingToCard" diameter="24"></mat-spinner><span *ngIf="!isRedirectingToCard">Pay Using Card</span></button></div></div>
                </mat-tab>
            </mat-tab-group>
        </mat-dialog-content>
    </div>
  `,
  styles: [`
    :host { 
        display: block; 
        --brand-turquoise: #037B7C; 
        --brand-lime: #B8D87A; 
        --brand-dark-text: #1f2937;
        --white-color: #fff;
        --light-gray: #f8f9fa;
        --medium-gray: #e9ecef;
        --dark-gray: #495057;
    }
    .payment-modal-container { background-color: var(--white-color); border-radius: 16px; overflow: hidden; max-width: 450px; box-shadow: 0 10px 30px rgba(0,0,0,.1); }
    .modal-header { display: flex; align-items: center; padding: 20px 24px; background-color: var(--brand-turquoise); color: var(--white-color); position: relative; }
    .header-icon-wrapper { width: 48px; height: 48px; background-color: rgba(255,255,255,.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 16px; flex-shrink: 0; }
    .header-icon-wrapper mat-icon { font-size: 28px; width: 28px; height: 28px; color: var(--brand-lime); }
    .modal-title { font-size: 20px; font-weight: 600; margin: 0; color: var(--white-color); }
    .modal-subtitle { font-size: 14px; opacity: .9; margin-top: 2px; color: var(--white-color); }
    .close-button { position: absolute; top: 12px; right: 12px; color: rgba(255,255,255,.7); }
    .close-button:hover { color: var(--white-color); }
    .modal-content { padding: 0 !important; background-color: var(--white-color); }
    .tab-panel-content { padding: 24px; }
    .sub-options { display: flex; gap: 8px; margin-bottom: 24px; border: 1px solid var(--medium-gray); border-radius: 12px; padding: 6px; background-color: var(--light-gray); }
    .sub-option-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; border-radius: 8px; border: none; background-color: transparent; font-weight: 500; cursor: pointer; transition: all .3s ease; color: var(--dark-gray); }
    .sub-option-btn.active { background-color: var(--white-color); color: var(--brand-turquoise); box-shadow: 0 2px 4px rgba(0,0,0,.05); }
    .instruction-text { text-align: center; color: var(--dark-gray); font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
    mat-form-field { width: 100%; }
    .action-button { width: 100%; height: 50px; border-radius: 9999px !important; background-color: var(--brand-turquoise) !important; color: var(--white-color) !important; font-size: 16px; font-weight: 600; }
    .action-button:hover:not(:disabled) { background-color: var(--brand-lime) !important; color: var(--brand-dark-text) !important; }
    .action-button:disabled { background-color: #a0a3c2 !important; }
    .paybill-details { background: var(--light-gray); border: 1px dashed #d1d5db; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .detail-item { display: flex; justify-content: space-between; align-items: center; font-size: 16px; padding: 12px 0; }
    .detail-item + .detail-item { border-top: 1px solid var(--medium-gray); }
    .detail-item .label { color: var(--dark-gray); }
    .detail-item .value { font-weight: 700; color: var(--brand-turquoise); }
    .detail-item .account-number { font-family: 'Courier New', monospace; background-color: var(--medium-gray); padding: 4px 8px; border-radius: 6px; }
    .card-redirect-info { text-align: center; }
    .animate-fade-in { animation: fadeIn .4s ease-in-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .tab-label-content { display: flex; align-items: center; gap: 8px; height: 60px; }
  `]
})
export class MpesaPaymentModalComponent implements OnInit {
    stkForm: FormGroup; mpesaSubMethod: 'stk' | 'paybill' = 'stk'; isProcessingStk = false; isVerifyingPaybill = false; isRedirectingToCard = false;
    constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<MpesaPaymentModalComponent>, @Inject(MAT_DIALOG_DATA) public data: MpesaPayment) { this.stkForm = this.fb.group({ phoneNumber: [data.phoneNumber || '', [Validators.required, Validators.pattern(/^(07|01)\d{8}$/)]] }); }
    ngOnInit(): void {}
    closeDialog(result: PaymentResult | null = null): void { this.dialogRef.close(result); }
    processStkPush(): void { if (this.stkForm.invalid) return; this.isProcessingStk = true; setTimeout(() => { this.isProcessingStk = false; this.closeDialog({ success: true, method: 'stk', reference: this.data.reference, mpesaReceipt: 'S' + Math.random().toString(36).substring(2, 12).toUpperCase() }); }, 3000); }
    verifyPaybillPayment(): void { this.isVerifyingPaybill = true; setTimeout(() => { this.isVerifyingPaybill = false; this.closeDialog({ success: true, method: 'paybill', reference: this.data.reference }); }, 3500); }
    redirectToCardGateway(): void { this.isRedirectingToCard = true; setTimeout(() => { this.isRedirectingToCard = false; console.log('Redirecting to secure payment gateway...'); this.closeDialog({ success: true, method: 'card', reference: this.data.reference }); }, 2000); }
}