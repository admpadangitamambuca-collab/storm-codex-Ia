//+------------------------------------------------------------------+
//| StormCodex_LocalBridge.mq5                                       |
//| Recebe sinais locais, mas INICIA TOTALMENTE DESLIGADO.            |
//| Requer ponte Node + Playwright e permissao WebRequest 127.0.0.1. |
//+------------------------------------------------------------------+
#property strict
#property version "1.00"
#include <Trade/Trade.mqh>
CTrade trade;

input string InpBridgeURL="http://127.0.0.1:8765";
input string InpBridgeToken="COLE_TOKEN_LOCAL_COM_32_OU_MAIS_CARACTERES";
input bool   InpEnableTrading=false;           // CONFIRMACAO EXPLICITA (DEMO PRIMEIRO)
input bool   InpAllowRealAccount=false;        // SEGUNDA TRAVA: REAL DESLIGADO
input double InpRiskPerTradePercent=0.50;     // risco max por entrada, estimado pelo SL
input double InpMaxDailyLossPercent=2.00;     // limite desde o primeiro start de cada dia
input double InpMaxLot=0.10;                  // teto absoluto adicional
input int    InpMaxSpreadPoints=40;
input int    InpMaxEntryDeviationPoints=80;
input int    InpMaxOpenPositions=1;
input int    InpMaxTradesPerDay=4;
input ulong  InpMagic=91108301;

bool busy=false;

string Trim(const string v) {string x=v;StringTrimLeft(x);StringTrimRight(x);return x;}
bool TokenOK() {
 return StringLen(InpBridgeToken)>=32 &&
        StringFind(InpBridgeToken,"COLE_TOKEN")<0 &&
        StringFind(InpBridgeToken,"CHANGE")<0;
}
bool Request(const string method,const string endpoint,const string body,string &answer,int &code) {
 char in[],out[];
 string headers="X-Storm-Token: "+InpBridgeToken+"\r\nContent-Type: text/plain\r\n";
 string outHeaders="";
 if(StringLen(body)>0)StringToCharArray(body,in,0,StringLen(body),CP_UTF8);
 ResetLastError();
 code=WebRequest(method,InpBridgeURL+endpoint,headers,3000,in,out,outHeaders);
 if(code<0) {
  Print("Storm MT5: falha WebRequest=",GetLastError(),
        ". Libere ",InpBridgeURL," em Ferramentas > Opcoes > Expert Advisors.");
  answer="";return false;
 }
 answer=CharArrayToString(out,0,ArraySize(out),CP_UTF8);
 return code==200 || code==204;
}
bool Ack(const string key,const string status,const string reason) {
 string resp="";int code=0;
 return Request("POST","/ack",key+"|"+status+"|"+reason,resp,code) && code==200;
}
string SignalGlobalKey(const string key) {
 return "SC_"+IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN))+"_"+key;
}
bool AlreadySeen(const string key,const string tag) {
 if(GlobalVariableCheck(SignalGlobalKey(key))) return true;
 for(int i=PositionsTotal()-1;i>=0;i--) {
  ulong p=PositionGetTicket(i);
  if(p>0 && PositionSelectByTicket(p) && (ulong)PositionGetInteger(POSITION_MAGIC)==InpMagic &&
     StringFind(PositionGetString(POSITION_COMMENT),tag)>=0) return true;
 }
 if(HistorySelect(TimeCurrent()-86400*30,TimeCurrent()+60)) {
  for(int i=HistoryDealsTotal()-1;i>=0;i--) {
   ulong d=HistoryDealGetTicket(i);
   if(d>0 && (ulong)HistoryDealGetInteger(d,DEAL_MAGIC)==InpMagic &&
      StringFind(HistoryDealGetString(d,DEAL_COMMENT),tag)>=0) return true;
  }
 }
 return false;
}
datetime DayStart() {
 MqlDateTime d;TimeToStruct(TimeTradeServer(),d);d.hour=0;d.min=0;d.sec=0;
 return StructToTime(d);
}
string DailyEquityKey() {
 MqlDateTime d;TimeToStruct(TimeTradeServer(),d);
 return StringFormat("SC_EQ_%I64d_%04d%02d%02d",
   AccountInfoInteger(ACCOUNT_LOGIN),d.year,d.mon,d.day);
}
bool RiskOK(const string symbol,const ENUM_ORDER_TYPE orderType,const double market,
            const double stop,double &lot,string &reason) {
 const double equity=AccountInfoDouble(ACCOUNT_EQUITY);
 const string dk=DailyEquityKey();
 if(!GlobalVariableCheck(dk))GlobalVariableSet(dk,equity);
 const double baseline=GlobalVariableGet(dk);
 if(equity<=0 || baseline<=0 || equity <= baseline*(1.0-InpMaxDailyLossPercent/100.0)) {
  reason="limite_perda_diaria";return false;
 }
 int positions=0;
 for(int i=PositionsTotal()-1;i>=0;i--) {
  ulong p=PositionGetTicket(i);
  if(p>0 && PositionSelectByTicket(p) && (ulong)PositionGetInteger(POSITION_MAGIC)==InpMagic)positions++;
 }
 if(positions>=InpMaxOpenPositions){reason="limite_posicoes";return false;}
 if(HistorySelect(DayStart(),TimeCurrent()+60)) {
  int total=0;
  for(int i=0;i<HistoryDealsTotal();i++){
   ulong d=HistoryDealGetTicket(i);
   if(d>0 && (ulong)HistoryDealGetInteger(d,DEAL_MAGIC)==InpMagic &&
      (ENUM_DEAL_ENTRY)HistoryDealGetInteger(d,DEAL_ENTRY)==DEAL_ENTRY_IN)total++;
  }
  if(total>=InpMaxTradesPerDay){reason="limite_operacoes";return false;}
 }
 double minLot=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MIN);
 double maxLot=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MAX);
 double step=SymbolInfoDouble(symbol,SYMBOL_VOLUME_STEP);
 if(minLot<=0 || step<=0 || InpMaxLot<minLot){reason="volume_minimo_acima_do_teto";return false;}
 double stopPnl=0;
 if(!OrderCalcProfit(orderType,symbol,minLot,market,stop,stopPnl) || !(stopPnl<0)){
  reason="risco_stop_indeterminado";return false;
 }
 double budget=equity*InpRiskPerTradePercent/100.0;
 if(-stopPnl>budget){reason="lote_minimo_excede_risco";return false;}
 double allowed=MathMin(MathMin(maxLot,InpMaxLot),minLot*(budget/(-stopPnl)));
 lot=minLot+MathFloor((allowed-minLot)/step+1.0e-7)*step;
 lot=NormalizeDouble(lot,8);
 if(lot<minLot || lot>maxLot || lot>InpMaxLot){reason="volume_invalido";return false;}
 double actualPnl=0;
 if(!OrderCalcProfit(orderType,symbol,lot,market,stop,actualPnl) || actualPnl>=0 ||
    -actualPnl>budget+0.01){reason="risco_recalculado";return false;}
 return true;
}
void ProcessSignal(const string payload) {
 string pieces[];
 int count=StringSplit(Trim(payload),'|',pieces);
 if(count!=8){Print("Storm MT5: formato de sinal inesperado; sem ordem.");return;}
 string key=Trim(pieces[0]),sym=Trim(pieces[1]),side=Trim(pieces[2]);
 double entry=StringToDouble(pieces[3]),sl=StringToDouble(pieces[4]),tp=StringToDouble(pieces[5]);
 long sentMs=(long)StringToInteger(pieces[6]);
 double score=StringToDouble(pieces[7]);
 if(StringLen(key)!=16 || (side!="buy" && side!="sell") || score<=83 || score>100 ||
    entry<=0 || sl<=0 || tp<=0 || sentMs<=0){
  Print("Storm MT5: payload rejeitado.");return;
 }
 const string tag="SC"+key;
 if(AlreadySeen(key,tag)){Ack(key,"already","dedup");return;}
 if(!SymbolSelect(sym,true)){Ack(key,"rejected","simbolo_indisponivel");return;}
 MqlTick tick;
 if(!SymbolInfoTick(sym,tick)||tick.ask<=0||tick.bid<=0){
  Ack(key,"rejected","cotacao_indisponivel");return;
 }
 double point=SymbolInfoDouble(sym,SYMBOL_POINT);
 if(point<=0){Ack(key,"rejected","point_invalido");return;}
 int spread=(int)SymbolInfoInteger(sym,SYMBOL_SPREAD);
 double market=side=="buy"?tick.ask:tick.bid;
 if(spread<0 || spread>InpMaxSpreadPoints){Ack(key,"rejected","spread_alto");return;}
 if(MathAbs(market-entry)/point>InpMaxEntryDeviationPoints){
  Ack(key,"rejected","preco_distante");return;
 }
 const double stopDist=(SymbolInfoInteger(sym,SYMBOL_TRADE_STOPS_LEVEL)+2)*point;
 if(side=="buy" && !(sl<tick.bid-stopDist && tp>tick.bid+stopDist)){
  Ack(key,"rejected","stops_invalidos_compra");return;
 }
 if(side=="sell" && !(sl>tick.ask+stopDist && tp<tick.ask-stopDist)){
  Ack(key,"rejected","stops_invalidos_venda");return;
 }
 ENUM_ORDER_TYPE type=side=="buy"?ORDER_TYPE_BUY:ORDER_TYPE_SELL;
 string reason="";double volume=0.0;
 if(!RiskOK(sym,type,market,sl,volume,reason)){Ack(key,"rejected",reason);return;}
 if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) ||
    !MQLInfoInteger(MQL_TRADE_ALLOWED) ||
    !AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)){
  Ack(key,"rejected","terminal_sem_permissao");return;
 }
 trade.SetExpertMagicNumber(InpMagic);
 trade.SetDeviationInPoints((ulong)InpMaxEntryDeviationPoints);
 trade.SetAsyncMode(false);
 if(!trade.SetTypeFillingBySymbol(sym)){Ack(key,"rejected","filling_mode");return;}
 const int digits=(int)SymbolInfoInteger(sym,SYMBOL_DIGITS);
 bool submitted=side=="buy"?
  trade.Buy(volume,sym,0,NormalizeDouble(sl,digits),NormalizeDouble(tp,digits),tag):
  trade.Sell(volume,sym,0,NormalizeDouble(sl,digits),NormalizeDouble(tp,digits),tag);
 uint code=trade.ResultRetcode();
 if(submitted && (code==TRADE_RETCODE_DONE || code==TRADE_RETCODE_PLACED ||
                   code==TRADE_RETCODE_DONE_PARTIAL)){
  // Persistir identificador imediatamente no terminal antes de confirmar ao servidor.
  GlobalVariableSet(SignalGlobalKey(key),(double)TimeCurrent());
  GlobalVariablesFlush();
  Ack(key,"executed",IntegerToString((int)code));
  Print("Storm MT5 DEMO/REAL: ordem aceita pelo servidor; id=",key,
        " ativo=",sym," volume=",DoubleToString(volume,4)," retcode=",code);
 } else {
  // Falha e rejeicao NAO sao reenviadas automaticamente. Confira Journal.
  Ack(key,"rejected",IntegerToString((int)code));
  Print("Storm MT5: ordem recusada, retcode=",code," ",trade.ResultRetcodeDescription());
 }
}
int OnInit() {
 if(!TokenOK()) {Print("Storm MT5: defina token privado em Inputs.");return INIT_PARAMETERS_INCORRECT;}
 if(InpRiskPerTradePercent<=0 || InpRiskPerTradePercent>1 || InpMaxDailyLossPercent<=0 ||
    InpMaxDailyLossPercent>5 || InpMaxLot<=0 || InpMaxOpenPositions<1 || InpMaxTradesPerDay<1){
  Print("Storm MT5: limites de risco invalidos.");return INIT_PARAMETERS_INCORRECT;
 }
 trade.SetAsyncMode(false);
 EventSetTimer(5);
 Print("Storm MT5 iniciado. Ordens=",InpEnableTrading?"HABILITADAS":"DESLIGADAS",
   " real=",InpAllowRealAccount?"permitido":"BLOQUEADO");
 return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) {EventKillTimer();}
void OnTimer() {
 if(busy)return;busy=true;
 string answer="";int code=0;
 const bool real=(ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL;
 Request("POST","/heartbeat",real?"real":"demo",answer,code);
 if(!InpEnableTrading || (real&&!InpAllowRealAccount)) {busy=false;return;}
 if(Request("GET","/next","",answer,code) && code==200)ProcessSignal(answer);
 busy=false;
}
//+------------------------------------------------------------------+