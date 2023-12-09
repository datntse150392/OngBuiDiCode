import { Component, OnDestroy, OnInit } from '@angular/core';
import { IPayPalConfig, ICreateOrderRequest } from 'ngx-paypal';
import { Router } from '@angular/router';
import {
  Cart,
  ConfigLocal,
  OperationType,
  UpdateEventCart,
} from 'src/app/core/models';
import {
  CartService,
  ShareService,
  ToastService,
  TransactionService,
} from 'src/app/core/services';
import { Subject, Subscription } from 'rxjs';
@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
})
export class CartComponent implements OnInit, OnDestroy {
  cart!: Cart;
  totalPrice: number = 0;
  configLocal!: ConfigLocal;
  blockedUI: boolean = false;

  DEFAULT: UpdateEventCart = {
    isUpdateConfigLocal: true,
    operationType: OperationType.Add,
  };

  private destroy$ = new Subject();

  private isDeleteCart = new Subject<boolean>();
  private updateEventCart: UpdateEventCart = this.DEFAULT;

  public payPalConfig?: IPayPalConfig;

  private deleteCartSubscription: Subscription | undefined;

  constructor(
    private cartService: CartService,
    private transactionService: TransactionService,
    private toastService: ToastService,
    private shareService: ShareService,
    private router: Router
  ) {}

  isDeleteCart$ = this.isDeleteCart.asObservable();
  setIsDeleteCart(isDeleteCart: boolean) {
    this.isDeleteCart.next(isDeleteCart);
  }

  ngOnInit(): void {
    const configLocalString = localStorage.getItem('configLocal');
    if (configLocalString) {
      this.configLocal = JSON.parse(configLocalString);
      const userId = JSON.parse(configLocalString).userInfo._id;
      this.cartService.getCartItems(userId).subscribe((res) => {
        if (res) {
          this.cart = res.data.cartItem;
          this.cart.items.map((item: any) => {
            this.totalPrice += item.amount;
            this.initConfig();
          });
        }
      });
    }
    // Issue right here is double code logic
    this.deleteCartSubscription = this.isDeleteCart$.subscribe({
      next: (res) => {
        if (res) {
          const configLocalString = localStorage.getItem('configLocal');
          if (configLocalString) {
            this.configLocal = JSON.parse(configLocalString);
            const userId = JSON.parse(configLocalString).userInfo._id;
            const cartId = this.configLocal.cartItems?._id;
            this.deleteCart(cartId);
            this.cartService.getCartItems(userId).subscribe((res) => {
              if (res) {
                this.cart = res.data.cartItem;
                this.cart.items.map((item: any) => {
                  this.totalPrice += item.amount;
                  this.initConfig();
                });
              }
            });
          }
        }
      },
    });
  }

  ngOnDestroy(): void {}

  /**
   * Logic Func: Get Cart
   */
  getCartAndCountAmount() {
    try {
      const configLocalString = localStorage.getItem('configLocal');
      if (configLocalString) {
        const userId = JSON.parse(configLocalString).userInfo._id;
        this.cartService.getCartItems(userId).subscribe((res) => {
          if (res) {
            this.cart = res.data.cartItem;
            this.cart.items.map((item: any) => {
              this.totalPrice += item.amount;
            });
          }
        });
      }
    } catch (error) {}
  }

  // Function to convert from VND to EUR
  convertVNDtoEUR(amountInVND: any, exchangeRate: any) {
    return amountInVND / exchangeRate;
  }

  // Function to convert from EUR to VND
  convertEURtoVND(amountInEUR: any, exchangeRate: any) {
    return amountInEUR * exchangeRate;
  }

  private initConfig(): void {
    const amountInVND = this.totalPrice; // Số tiền thanh toán trong VND

    const exchangeRate = 25000; // Tỉ giá hối đoái từ VND sang EUR (ví dụ)
    // Chuyển đổi số tiền sang EUR
    const amountInEUR = this.convertVNDtoEUR(amountInVND, exchangeRate);
    this.payPalConfig = {
      currency: 'EUR',
      clientId: 'sb',
      createOrderOnClient: (data) =>
        <ICreateOrderRequest>{
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: {
                currency_code: 'EUR',
                value: amountInEUR.toFixed(2), // Giữ hai chữ số thập phân
                breakdown: {
                  item_total: {
                    currency_code: 'EUR',
                    value: amountInEUR.toFixed(2),
                  },
                },
              },
              items: [
                {
                  name: 'Thanh toán khóa học - PayPal',
                  quantity: '1',
                  category: 'DIGITAL_GOODS',
                  unit_amount: {
                    currency_code: 'EUR',
                    value: amountInEUR.toFixed(2),
                  },
                },
              ],
            },
          ],
        },
      advanced: {
        commit: 'true',
      },
      style: {
        label: 'paypal',
        layout: 'vertical',
      },
      onApprove: (data, actions) => {
        this.blockedUI = true;
        actions.order.get().then((details: any) => {
          console.log(
            'onApprove - you can get full order details inside onApprove: ',
            details
          );
          try {
            const cartId = this.cart._id;
            const customerEmail = this.configLocal.userInfo.email;
            const amount = this.totalPrice;
            const payer = details.payer;
            const transactionType = 'Register Course';
            const status = 'success';
            this.transactionService
              .processPaymentAndSaveTransaction(
                cartId,
                amount,
                payer,
                transactionType,
                status,
                customerEmail
              )
              .subscribe((res: any) => {
                if (res && res.status === 200) {
                  this.toastService.setToastIsTransaction(true);
                  this.shareService.setIsUpdateConfigLocal(
                    (this.updateEventCart = {
                      isUpdateConfigLocal: true,
                      operationType: OperationType.Delete,
                    })
                  );
                  this.blockedUI = false;
                  this.router.navigate(['/']);
                }
              });
          } catch (error) {
            this.toastService.setToastIsTransaction(false);
          }
        });
      },
      onClientAuthorization: (data) => {},
      onCancel: (data, actions) => {},
      onError: (err) => {},
      onClick: (data, actions) => {},
    };
  }
  /**
   * Logic Func: Delete Cart by cartId
   */
  deleteCart(cartId: any) {
    try {
      this.cartService.deleteCart(cartId).subscribe({
        next: (res) => {
          if (res && res.status === 200) {
            this.shareService.setIsUpdateConfigLocal(
              (this.updateEventCart = {
                isUpdateConfigLocal: true,
                operationType: OperationType.Delete,
              })
            );
            this.toastService.setToastIsDeleteCart(true);
            window.location.reload(); // This is bug need to be fixed
          }
        },
        error: (err: Error) => {
          console.log(err);
        },
        complete: () => {},
      });
    } catch (error) {}
  }
}
