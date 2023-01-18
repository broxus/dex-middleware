
Задача сервиса дать готовый токен трансфер пейлоад, и информационные данные T.B.D

разберём кейсы

1) chain1_erc20_A -> tip3_A -> swap to tip3_B (min amount)-> send tokens with notify + custom payload
   Входные данные от коллера
- In token
- In amount
- Out token
- Destintaion
- Custom payload for success scenario
- Custom payload for cancel scenario

Наши действия
- формируем обычный пейлоад для свопа из (`In token`, `In amount`, `Out token`)
- Взаимодействуем с DexMiddleware
  
В первую очередь нам нужно собрать правильный пейлоад и отдать на билд, в данном случае он будет выглядеть вот так
```typescript
const payloadForDexMiddleware = dexMiddleware.getPayload({
      _payloadsForDex: [
        {
          dexPayload: payload, // <- payload for dex swap
          rootToSendersAllowanceMap: [
            [tstTokenRoot.address, [context.dex.getDexVault().address]],
            [coinTokenRoot.address, [context.dex.getDexVault().address]],                             // <- API already includes it
            [qweTokenRoot.address, [context.dexMiddleware.contract.address, dexPoolFooBarQwe.address]],
          ],
          remainingGasTo: user.account.address,
          cancelPayload: {
            payload: "",
            tokenReceiver: user.account.address,
            valueForFinalTransfer: toNano("0.2"),   // <- Custom payload for cancel scenario
            deployWalletValue: toNano("0.2"),
          },
          successPayload: {
            payload: "",
            tokenReceiver: user.account.address,
            valueForFinalTransfer: toNano(3), // <- Custom payload for cancel scenario
            deployWalletValue: toNano("0.2"),
          },
          deployWalletValue: toNano(1),
          valueForDexOperation: toNano(3), // <- Value that will sand to the dex, API already includes it
          firstRoot: firstPool, // <- API already includes it
          leaves, // <- API already includes it
          tokensAmount: new BigNumber(TOKENS_AMOUNT).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString(), // <- Tokens amout that will be directed to the DEX
        },
      ],
      _payloadsForTransfers: [],
      _payloadsForBurn: [],
      _payloadForUnwrap: [],
      _remainingTokensTo: user.account.address,
      _tokensDistributionType: 0, // <- 0 means tokens will be destributed by `tokensAmount`, 1 means all tokens will be directed to the only one flow
    })
```
Следующий этап подсчёт необходимого кол-ва токенов и газа, которые нужно будет направить в месте с транзакцией
```typescript
    const {
    everValue, // <- gas
    tokenAmount // <- tokens
} = await context.dexMiddleware.contract.methods
      .calculateFeeAndTokensValue({
        _transferPayload: payloadForDexMiddleware,
      })
      .call()
      .then(res => res.value0);
```
На этом подготовительный этап закончен и мы можем отдать коллеру неоюходимые данные чтобы он смог завершить свой флоу
```rust
struct Response {
    tokens_transfer_payload: String,
    send_to: String, // <- DexMiddleware address
    ever_amount: u128,
    token_amount: u128,
    min_token_amount_receive: u128,
    token_amount_receive: u128,
}
```

2) chain1_erc20_A -> tip3_A -> swap to tip3_wToken (min amount) -> unwrap to native -> send call with custom payload
Данный кейс основывается на предидущем, но тут начинается древовидная структура. Разделим данный флоу на условные две стратегии


  Входные данные от коллера
- In token
- In amount
- Out token, in this case out token should be marked as `native`
- Destintaion
- Custom payload for success scenario
- Custom payload for cancel scenario

  Наши действия
- формируем обычный пейлоад для свопа из (`In token`, `In amount`, `Out token(WEVER)`)
- Взаимодействуем с DexMiddleware

Для простоты понимания разделим данный флоу на две шага, и эти шаги идут в обратном порядке
1. unwrap to native -> send call with custom payload
- получаем пейлоад для анврапа, тут важный момент, так как мы не знаем сколько точно получим токенов после свопа нам не нужно
указывать точное значение в `amount`, поэтому можно просто поставить 0, но поставить тип у  `_tokensDistributionType` как `1`
```typescript
const payloadForUnwrap = await context.dexMiddleware.contract.methods
      .buildPayload({
        _payloadsForDex: [],
        _payloadsForBurn: [],
        _payloadsForTransfers: [],
        _payloadForUnwrap: [
          {
            amount: 0, // <- because we don't not particular amount after swap
            payload: "",
            remainingGasTo: user.account.address,
            destination: user.account.address,
            attachedValue: toNano(0.5),
          },
        ],
        _tokensDistributionType: 1, // <- we want to unwrap all tokens
        _remainingTokensTo: user.account.address,
      })
```
- Считаем необходимое кол-во токенов(тут будет 0) и газа
```typescript
const {
    everValue, // <- gas
    tokenAmount // <- tokens
} = await context.dexMiddleware.contract.methods
      .calculateFeeAndTokensValue({
        _transferPayload: payloadForDexMiddleware,
      })
      .call()
      .then(res => res.value0);
```
2. В шаге 1 мы получили второй шаг нашего флоу, теперь мы готовы формировать первый шаг
`chain1_erc20_A -> tip3_A -> swap to tip3_wToken`
- Собираем своп пейлоад из API, он будет для `In token -> WEVER`
- Для cancel сценария пользователь должен сам дать данные
- А вот для success сценария, все данные у нас уже есть из первого шага
```typescript
const payloadForDexMiddleware = dexMiddleware.getPayload({
      _payloadsForDex: [
        {
          dexPayload: payload, // <- payload for dex swap
          rootToSendersAllowanceMap: [
            [tstTokenRoot.address, [context.dex.getDexVault().address]],
            [coinTokenRoot.address, [context.dex.getDexVault().address]],                             // <- API already includes it
            [qweTokenRoot.address, [context.dexMiddleware.contract.address, dexPoolFooBarQwe.address]],
          ],
          remainingGasTo: user.account.address,
          cancelPayload: {
            payload: "",
            tokenReceiver: user.account.address,
            valueForFinalTransfer: toNano("0.2"),   // <- Custom payload for cancel scenario
            deployWalletValue: toNano("0.2"),
          },
          successPayload: {
            payload: payloadForUnwrap, // <- payload that was received from step 1
            tokenReceiver: dexMiddlewareAddress, // <- Address of dex middleware for recursive entrance
            valueForFinalTransfer: everValue, // ever value that was received in amount calculation of step 1
            deployWalletValue: 0,// can be set as 0, because dex middleware already has WEVER address
          },
          deployWalletValue: toNano(1),
          valueForDexOperation: toNano(3), // <- Value that will sand to the dex, API already includes it
          firstRoot: firstPool, // <- API already includes it
          leaves, // <- API already includes it
          tokensAmount: new BigNumber(TOKENS_AMOUNT).shiftedBy(Number(qweTokenWallet.tokenDecimals)).toString(), // <- Tokens amout that will be directed to the DEX
        },
      ],
      _payloadsForTransfers: [],
      _payloadsForBurn: [],
      _payloadForUnwrap: [],
      _remainingTokensTo: user.account.address,
      _tokensDistributionType: 0, // <- 0 means tokens will be destributed by `tokensAmount`, 1 means all tokens will be directed to the only one flow
    })
```
- Снова считаем необходимое кол-во токенов и газа 
```typescript
const {
    everValue, // <- gas
    tokenAmount // <- tokens
} = await context.dexMiddleware.contract.methods
      .calculateFeeAndTokensValue({
        _transferPayload: payloadForDexMiddleware,
      })
      .call()
      .then(res => res.value0);
```
На этом подготовительный этап закончен и мы можем отдать коллеру неоюходимые данные чтобы он смог завершить свой флоу
```rust
struct Response {
    tokens_transfer_payload: String,
    send_to: String, // <- DexMiddleware address
    ever_amount: u128,
    token_amount: u128,
    min_ever_amount_receive: u128,
    ever_amount_receive: u128,
}
```
