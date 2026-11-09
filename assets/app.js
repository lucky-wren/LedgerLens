(function(){
'use strict';
globalThis.__LEDGERLENS__ = {
  "name": "账镜 LedgerLens",
  "version": "1.1.0",
  "buildTime": "2026-11-09T12:31:17.602Z",
  "defaultCurrency": "¥",
  "lang": "zh-CN",
  "mode": "static",
  "note": "所有计算都在浏览器里完成；本站点没有服务端，账目不会上传。"
};
/* ===== core/ll.js ===== */
/* 统一逻辑层命名空间：所有 core 模块都往 LL 上挂函数，彼此零耦合。 */
const LL = {};
globalThis.LL = LL;


/* ===== core/utils.js ===== */

/* ---------- 基础工具 ---------- */
const pad = n => String(n).padStart(2,'0');
LL.pad = pad;
LL.fmtDate = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
LL.parseDateStr = s => { const p=String(s).split('-').map(Number); return new Date(p[0],p[1]-1,p[2]); };
LL.addDays = (s,n) => { const d=LL.parseDateStr(s); d.setDate(d.getDate()+n); return LL.fmtDate(d); };
LL.weekday = s => (LL.parseDateStr(s).getDay()+6)%7; // 0=周一
LL.WEEK_NAMES = ['周一','周二','周三','周四','周五','周六','周日'];
LL.sum = (a,f) => a.reduce((s,x)=>s+(f?f(x):x),0);
LL.avg = a => a.length? LL.sum(a)/a.length : 0;
LL.std = a => { if(!a.length) return 0; const m=LL.avg(a); return Math.sqrt(LL.sum(a.map(v=>(v-m)*(v-m)))/a.length); };
LL.round = (v,n) => { const p=Math.pow(10,n||0); return Math.round(v*p)/p; };
LL.CUR = '¥';   // 币种符号，导入时可按源文件选择；仅影响显示，不做任何汇率换算
LL.money = function(v,compact){
  const neg = v<0, a=Math.abs(v), c=LL.CUR||'';
  let s;
  if(compact && a>=10000) s=c+LL.round(a/10000,1)+'万';
  else s=c+a.toLocaleString('zh-CN',{minimumFractionDigits:0,maximumFractionDigits:2});
  return (neg?'-':'')+s;
};
LL.pct = (v,n) => LL.round(v*100,n===undefined?1:n)+'%';
LL.esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));


/* ===== core/rules.js ===== */

/* ---------- 判定标准（可调，默认与旧版硬编码逐项一致） ---------- */
LL.RULE_DEFS=[
  {group:'生意走势',key:'netChange',label:'进账涨跌提醒线',unit:'%',scale:100,def:0.05,min:1,max:50,step:1,tip:'比上一段多/少超过这么多，才说「生意好了 / 淡了」'},
  {group:'生意走势',key:'ticketDrop',label:'客人花钱下降线',unit:'%',scale:100,def:0.03,min:1,max:30,step:1,tip:'平均每位客人花得少了这么多，就提醒'},
  {group:'生意走势',key:'tailDays',label:'连着几天偏淡',unit:'天',scale:1,def:3,min:2,max:14,step:1,tip:'连续多少天低于平均，才算一段趋势而不是偶然一天'},
  {group:'生意走势',key:'cvStable',label:'算「很稳」的起伏上限',unit:'%',scale:100,def:0.35,min:5,max:100,step:5,tip:'每天进账的起伏低于这个数，就说这段时间平稳'},
  {group:'生意走势',key:'weekDiff',label:'周末工作日差异线',unit:'%',scale:100,def:0.08,min:1,max:50,step:1,tip:'两边差超过这么多，才提醒排班可以调整'},

  {group:'退款',key:'refundMarket',label:'超市退款提醒线',unit:'%',scale:100,def:0.025,min:0.5,max:30,step:0.5,tip:'超市退回去的钱占收进来的比例超过它，就提醒'},
  {group:'退款',key:'refundPharmacy',label:'药店退款提醒线',unit:'%',scale:100,def:0.03,min:0.5,max:30,step:0.5,tip:'药店天然退得稍多，单独一条线'},
  {group:'退款',key:'refundHotel',label:'酒店退款提醒线',unit:'%',scale:100,def:0.02,min:0.5,max:30,step:0.5,tip:'酒店一般更低，单独一条线'},
  {group:'退款',key:'refundMixed',label:'多种生意混合时',unit:'%',scale:100,def:0.03,min:0.5,max:30,step:0.5,tip:'超市、药店、酒店混在一起时用这条'},

  {group:'赚的差价',key:'gmMarket',label:'超市差价占比参考线',unit:'%',scale:100,def:0.20,min:1,max:90,step:1,tip:'每收 100 元里，超市一般得有这么多是差价'},
  {group:'赚的差价',key:'gmPharmacy',label:'药店差价占比参考线',unit:'%',scale:100,def:0.30,min:1,max:90,step:1,tip:'药店一般比超市高一点'},
  {group:'赚的差价',key:'gmHotel',label:'酒店差价占比参考线',unit:'%',scale:100,def:0.60,min:1,max:95,step:1,tip:'房费成本很低，所以这条线高得多'},
  {group:'赚的差价',key:'costCoverage',label:'进价要齐到几成',unit:'%',scale:100,def:0.95,min:50,max:100,step:1,tip:'记了进价的账少于这个比例，就提醒看毛利要留意'},
  {group:'赚的差价',key:'profitDrop',label:'差价掉得比进账快',unit:'%',scale:100,def:0.08,min:1,max:50,step:1,tip:'差价少这么多、而进账没怎么掉，就提醒查结构'},

  {group:'异常与结构',key:'sigmaDay',label:'忽高忽低倍数',unit:'σ',scale:1,def:2,min:1,max:4,step:0.5,tip:'某天离平均超过这么多倍起伏，就挑出来核对'},
  {group:'异常与结构',key:'sigmaOrder',label:'大单倍数',unit:'σ',scale:1,def:3,min:1,max:6,step:0.5,tip:'单笔金额超过平均这么多倍起伏，就挑出来核对'},
  {group:'异常与结构',key:'lateRatio',label:'半夜占比提醒线',unit:'%',scale:100,def:0.12,min:1,max:50,step:1,tip:'晚上 10 点到早 6 点占比超过它，就提醒查日结时间'},
  {group:'异常与结构',key:'payShare',label:'一种收款占比提醒线',unit:'%',scale:100,def:0.70,min:30,max:100,step:5,tip:'钱太集中在一种收款方式时提醒留备用通道'},
  {group:'异常与结构',key:'catConcentration',label:'一类货占比提醒线',unit:'%',scale:100,def:0.55,min:20,max:100,step:5,tip:'最卖钱的一类占超过它，就提醒别把鸡蛋放一个篮子'}
];
LL.DEFAULT_RULES={}; LL.RULE_DEFS.forEach(d=>LL.DEFAULT_RULES[d.key]=d.def);
LL.RULES=Object.assign({},LL.DEFAULT_RULES);

function mulberry32(a){
  return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
}
LL.mulberry32 = mulberry32;


/* ===== core/biz.js ===== */

/* ---------- 业态配置（演示数据） ---------- */
/* cats: [品类名, 权重, 均价, 参考毛利率] —— 毛利率仅用于生成演示成本 */
LL.BIZ = {
  supermarket:{ name:'超市', baseOrders:118, refundRate:0.022, expenseRate:0.010, gmRef:0.20,
    cats:[['生鲜果蔬',.24,46,.16],['粮油副食',.17,72,.12],['零食饮料',.19,32,.30],['日用百货',.15,58,.28],['乳品冷饮',.13,38,.22],['烟酒',.12,168,.09]],
    pays:[['微信支付',.38],['支付宝',.27],['银联卡',.16],['现金',.11],['会员储值卡',.08]],
    hours:[0,0,0,0,0,0,1,3,6,9,13,12,9,8,8,9,11,14,15,13,9,5,2,0],
    stores:['万象汇店','人民广场店','河东北路店'], ticketMin:28, ticketMax:210,
    weekFactor:[.92,.90,.93,.96,1.12,1.34,1.22], memberRate:.42 },
  pharmacy:{ name:'药店', baseOrders:74, refundRate:0.050, expenseRate:0.008, gmRef:0.30,
    cats:[['处方药',.28,96,.14],['OTC 常备药',.24,42,.34],['保健品',.17,138,.46],['医疗器械',.13,165,.38],['中药饮片',.10,78,.36],['计生护理',.08,36,.42]],
    pays:[['医保电子凭证',.44],['微信支付',.24],['支付宝',.14],['现金',.09],['银行卡',.09]],
    hours:[0,0,0,0,0,0,0,2,7,11,13,11,9,8,9,10,11,10,7,4,2,1,0,0],
    stores:['中心药房','北城新区店'], ticketMin:22, ticketMax:320,
    weekFactor:[1.02,1.00,.98,1.01,1.06,1.10,1.05], memberRate:.55 },
  hotel:{ name:'酒店', baseOrders:44, refundRate:0.016, expenseRate:0.020, gmRef:0.60,
    cats:[['房费',.62,428,.80],['餐饮',.18,128,.55],['会议宴会',.09,1680,.62],['会员卡/储值',.06,800,.92],['杂项商品',.05,58,.45]],
    pays:[['微信支付',.30],['银行卡预授权',.29],['支付宝',.18],['公司挂账',.16],['现金',.07]],
    hours:[1,0,0,0,0,0,1,3,8,13,9,7,16,11,15,10,8,7,6,5,4,3,2,1],
    stores:['沂河宾馆','兰山商务店'], ticketMin:180, ticketMax:1980,
    weekFactor:[.86,.88,.92,.98,1.20,1.46,1.10], memberRate:.31 }
};
LL.BIZ_KEYS = Object.keys(LL.BIZ);

function pickWeighted(items,rnd,idx){
  const wi=idx||1;
  let total=0; for(let i=0;i<items.length;i++) total+=Math.max(0,items[i][wi]||0);
  if(total<=0) return items[0];
  let r=rnd()*total, acc=0;
  for(let i=0;i<items.length;i++){ acc+=Math.max(0,items[i][wi]||0); if(r<=acc) return items[i]; }
  return items[items.length-1];
}

/* 生成三业态 90 天演示流水（可复现） */
LL.generateDemoData = function(endDate, days){
  endDate = endDate || '2026-11-08';
  days = days || 90;
  const rnd = LL.mulberry32(20261108);
  const out = [];
  const start = LL.addDays(endDate,-(days-1));
  let seq = 0;
  for(let di=0; di<days; di++){
    const date = LL.addDays(start,di);
    const wd = LL.weekday(date);
    for(const bk of LL.BIZ_KEYS){
      const B = LL.BIZ[bk];
      // 缓慢增长趋势 + 周期 + 噪声 + 人为异常
      const trend = 0.90 + 0.20*(di/days);
      let factor = B.weekFactor[wd]*trend*(0.88+rnd()*0.26);
      if(di===days-16) factor*=0.62;            // 突降日（模拟系统故障/恶劣天气）
      if(di===days-9)  factor*=1.38;            // 突增日（模拟大促）
      if(di>=days-5) factor*=0.68; // 末尾连续走弱（含最后一天）
      const n = Math.max(4,Math.round(B.baseOrders*factor));
      for(let k=0;k<n;k++){
        seq++;
        const cat = pickWeighted(B.cats,rnd,1);
        const pay = pickWeighted(B.pays,rnd,1);
        const hour = pickWeighted(B.hours.map((w,h)=>[h,w]),rnd,1)[0];
        const minute = Math.floor(rnd()*60);
        let amt = cat[2]*(0.55+rnd()*1.35);
        if(bk==='hotel' && cat[0]==='会议宴会') amt*=1.6;
        amt = Math.max(B.ticketMin,Math.min(B.ticketMax,amt));
        // 深夜时段偶发超大额（异常单）
        if(rnd()<0.0016) amt*= (3.2+rnd()*3);
        amt = LL.round(amt,2);
        const store = B.stores[Math.floor(rnd()*B.stores.length)];
        const cost = LL.round(amt*(1-(cat[3]||0.3))*(0.94+rnd()*0.12),2);
        out.push({
          date:date, time:LL.pad(hour)+':'+LL.pad(minute), orderNo:(bk.slice(0,2).toUpperCase()+date.replace(/-/g,'')+'-'+String(seq).padStart(6,'0')),
          amount:amt, cost:cost, direction:'收入', payMethod:pay[0], category:cat[0],
          item:cat[0]+'商品'+String(1+Math.floor(rnd()*20)).padStart(2,'0'),
          qty:1+Math.floor(rnd()*3), store:store, biz:bk,
          member:rnd()<B.memberRate?('M'+String(10000+Math.floor(rnd()*89999))):'',
          src:'演示'
        });
        // 退款单
        if(rnd()<B.refundRate){
          seq++;
          const refundAmt=LL.round(amt*(0.55+rnd()*0.45),2);
          out.push({
            date:date, time:LL.pad(Math.min(23,hour+1))+':'+LL.pad(minute),
            orderNo:'RF'+date.replace(/-/g,'')+'-'+String(seq).padStart(6,'0'),
            amount:-refundAmt, cost:LL.round(cost*(refundAmt/amt),2), direction:'退款',
            payMethod:pay[0], category:cat[0], item:'退货·'+cat[0], qty:1,
            store:store, biz:bk, member:'', src:'演示'
          });
        }
        // 支出（采购/杂项）
        if(rnd()<B.expenseRate){
          seq++;
          out.push({
            date:date, time:LL.pad(hour)+':'+LL.pad(minute),
            orderNo:'EX'+date.replace(/-/g,'')+'-'+String(seq).padStart(6,'0'),
            amount:-LL.round(120+rnd()*900,2), cost:null, direction:'支出',
            payMethod:'银行转账', category:'运营支出', item:'日常采购/损耗', qty:1,
            store:store, biz:bk, member:'', src:'演示'
          });
        }
      }
    }
  }
  return out;
};


/* ===== core/fields.js ===== */

/* ---------- 字段定义与同义词库 ---------- */
LL.FIELD_DEFS = [
  {key:'date',      label:'日期',        req:true,  aliases:['日期','交易日期','营业日期','发生日期','记账日期','结算日期','交易时间','下单时间','发生时间','交易日期时间','销售日期','入账日期','date','tradedate','trade_date','invoicedate','bizdate','businessdate','datum','datetime','time','订单日期','交易日期时间']},
  {key:'time',      label:'时间',        req:false, aliases:['时间','交易时间','具体时间','时分','成交时间','收款时间','结账时间','发生时间','posttime','trantime','paytime','小时','交易时刻']},
  {key:'orderNo',   label:'单号',        req:false, aliases:['单号','单据编号','订单号','流水号','交易单号','订单编号','微信订单号','支付宝交易号','商户订单号','票据号','凭证号','销售单号','发票号','folio_no','foliono','invoice_no','invoiceno','invoice','receiptno','orderno','orderid','trade_no','billno','serialno','transid']},
  {key:'amount',    label:'金额',        req:true,  aliases:['金额','实收金额','实付金额','订单金额','应结订单金额','应结金额','发生金额','交易金额','收款金额','结算金额','收入金额','成交金额','含税金额','销售金额','行金额','订单总额','charge','linetotal','totalprice','salesamount','amount','total','totalamount','paidamount','receivable','实际金额','消费金额','金额(元)']},
  {key:'unitPrice', label:'单价（用于合成金额）', req:false, aliases:['单价','销售单价','含税单价','unitprice','unit_price','price','单件价']},
  {key:'cost',      label:'成本金额',    req:false, aliases:['成本','成本金额','销售成本','商品成本','采购成本','进货成本','成本额','cost','costamount','totalcost','cogs','costofgoods','costprice']},
  {key:'unitCost',  label:'单位成本（用于合成成本）', req:false, aliases:['单位成本','单件成本','进价','进价单价','单位进价','unitcost','unit_cost','costperunit','purchaseprice']},
  {key:'grossProfit',label:'毛利额（可选，可反推成本）',req:false,aliases:['毛利','毛利额','销售毛利','商品毛利','毛利金额','grossprofit','grossmargin','marginamount','profitamount','profit']},
  {key:'direction', label:'收支方向',    req:false, aliases:['方向','收支','收支方向','交易类型','业务类型','类型','状态','交易状态','订单状态','备注类型','退款标记','冲销标记','voidflag','cancelflag','isrefund','refundflag','direction','type','trantype','orderstatus','收支类型']},
  {key:'payMethod', label:'支付方式',    req:false, aliases:['支付方式','结算方式','付款方式','支付渠道','渠道','收款方式','付款渠道','结算渠道','deposittype','settlemode','paymethod','paytype','paychannel','channel','支付方式名称']},
  {key:'category',  label:'品类/收入项', req:false, aliases:['品类','分类','商品分类','类别','商品类别','大类','部门','收入项','项目','科目','商品大类','药品分类','收入中心','revenuecenter','category','class','dept','department','itemtype','类别名称']},
  {key:'item',      label:'商品/明细',   req:false, aliases:['商品','商品名称','品名','项目名称','明细','摘要','商品描述','备注','说明','itemdesc','description','drugname','item','product','goodsname','productname','subject']},
  {key:'qty',       label:'数量',        req:false, aliases:['数量','件数','份数','销售数量','购买数量','间夜','nights','quantity','qty','count','num']},
  {key:'store',     label:'门店',        req:false, aliases:['门店','门店名称','店铺','分店','网点','机构','商户名称','商铺','营业点','门店编码','门店编号','hotelcode','shopcode','storecode','store','shop','branch','storename','merchant']},
  {key:'member',    label:'会员/客号',   req:false, aliases:['会员','会员卡号','会员号','客户','客号','顾客','卡号','会员等级','memberlevel','vip','member','memberno','customer','客户编号']},
  {key:'biz',       label:'业态',        req:false, aliases:['业态','业态类型','行业','经营业态','业务板块','biz','industry','businesstype']}
];

LL.normalizeHeader = function(s){
  return String(s==null?'':s).trim().toLowerCase()
    .replace(/[\s\u3000]/g,'')
    .replace(/[（）()\[\]【】]/g,'')
    .replace(/(元|金额单位|单位|名称|编号|号)$/,'')
    .replace(/[＿_·\-—/\\.,:;'"*#]/g,'');
};

LL.cleanAmount = function(v){
  if(v==null) return NaN;
  let s=String(v).trim();
  if(s===''||s==='-'||s==='--') return NaN;
  let neg=false;
  if(/^\(.*\)$/.test(s)){ neg=true; s=s.slice(1,-1); }
  s=s.replace(/[¥￥$£€₩₹,，\s元圆人民币]/g,'')
     .replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248))
     .replace(/[−–—－﹣]/g,'-').replace(/[＋﹢]/g,'+');
  if(s.charAt(0)==='-'){ neg=true; s=s.slice(1); }
  if(s.charAt(0)==='+') s=s.slice(1);
  const n=parseFloat(s);
  if(isNaN(n)) return NaN;
  return neg? -n : n;
};

LL.cleanDate = function(v){
  if(v==null) return '';
  let s=String(v).trim();
  if(!s) return '';
  // Excel 序列号
  if(/^\d{4,6}(\.\d+)?$/.test(s)){
    const num=parseFloat(s);
    if(num>20000 && num<80000){
      const d=new Date(1899,11,30); d.setDate(d.getDate()+Math.floor(num));
      return LL.fmtDate(d);
    }
  }
  let m=s.match(/^(\d{4})[-\/.年](\d{1,2})[-\/.月](\d{1,2})/);
  if(m) return m[1]+'-'+LL.pad(+m[2])+'-'+LL.pad(+m[3]);
  m=s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if(m) return m[1]+'-'+m[2]+'-'+m[3];
  // 美式 M/D/YYYY 或 M/D/YY（可带时间），UCI / 支付对账单 / 部分 POS 导出的真实格式
  m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T]\d{1,2}:\d{2})?/);
  if(m){
    let y=+m[3];
    if(y<100) y += (y<70?2000:1900);
    return y+'-'+LL.pad(+m[1])+'-'+LL.pad(+m[2]);
  }
  // 英文月份名：July 1, 2015 / 2015 July 1（PMS 导出常见）
  const MON={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,
             september:9,october:10,november:11,december:12,
             jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
  m=s.match(/^(\d{4})\s+([A-Za-z]+)\s+(\d{1,2})/);
  if(m && MON[m[2].toLowerCase()]) return m[1]+'-'+LL.pad(MON[m[2].toLowerCase()])+'-'+LL.pad(+m[3]);
  m=s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if(m && MON[m[1].toLowerCase()]) return m[3]+'-'+LL.pad(MON[m[1].toLowerCase()])+'-'+LL.pad(+m[2]);
  return '';
};
LL.cleanTime = function(v, fromDateVal){
  let s=String(v==null?'':v).trim();
  if(!s && fromDateVal) s=String(fromDateVal);
  if(!s) return '00:00';
  let m=s.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if(m) return LL.pad(+m[1])+':'+LL.pad(+m[2]);
  m=s.match(/^(\d{2})(\d{2})(\d{2})$/);
  if(m) return m[1]+':'+m[2];
  return '';
};


/* ===== core/parse-text.js ===== */

/* ---------- 表格解析（CSV / TSV / 分号 / JSON） ---------- */
LL.parseDelimited = function(text){
  text=String(text||'').replace(/^\uFEFF/,'').trim();
  if(!text) return {headers:[],rows:[]};
  if(text.charAt(0)==='[' || text.charAt(0)==='{'){
    try{
      let obj=JSON.parse(text);
      let arr=Array.isArray(obj)?obj:(obj.data||obj.rows||obj.list||obj.records||[]);
      if(Array.isArray(arr)&&arr.length&&typeof arr[0]==='object'&&!Array.isArray(arr[0])){
        const headers=Object.keys(arr[0]);
        return {headers:headers,rows:arr.map(o=>headers.map(h=>o[h]==null?'':String(o[h])))};
      }
    }catch(e){ /* 继续按文本处理 */ }
  }
  const first=text.split(/\r?\n/)[0];
  const cand=[['\t',(first.match(/\t/g)||[]).length],[',',(first.match(/,/g)||[]).length],[';',(first.match(/;/g)||[]).length],['|',(first.match(/\|/g)||[]).length]];
  cand.sort((a,b)=>b[1]-a[1]);
  const delim=cand[0][1]>0?cand[0][0]:'\t';
  const rows=[]; let row=[], field='', inQ=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(inQ){
      if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i++; } else inQ=false; }
      else field+=c;
    }else{
      if(c==='"') inQ=true;
      else if(c===delim){ row.push(field.trim()); field=''; }
      else if(c==='\n'){ row.push(field.trim()); if(row.some(x=>x!=='')) rows.push(row); row=[]; field=''; }
      else if(c==='\r'){ /* skip */ }
      else field+=c;
    }
  }
  row.push(field.trim()); if(row.some(x=>x!=='')) rows.push(row);
  if(!rows.length) return {headers:[],rows:[]};
  const headers=rows[0].map((h,i)=>h||('列'+(i+1)));
  const body=rows.slice(1).filter(r=>r.some(x=>x!==''));
  const width=headers.length;
  return {headers:headers,rows:body.map(r=>{ const x=r.slice(0,width); while(x.length<width)x.push(''); return x; }),delimiter:delim};
};


/* ===== core/xlsx.js ===== */

/* =====================================================================
   XLSX 读写：零依赖 ZIP(DEFLATE) + 轻量 XML 解析
   - 读：支持 .xlsx（sharedStrings / inlineStr / 日期样式 / 多工作表）
   - 写：生成 stored 模式的示例 .xlsx，给用户做导入演示
   不联网、不引 CDN、不依赖 DOMParser，浏览器与 Node 均可运行
   ===================================================================== */
LL.inflateRaw = function(src){
  let p=0, bb=0, bc=0;
  const bits=n=>{
    while(bc<n){ if(p>=src.length) throw new Error('deflate 数据不完整'); bb|=src[p++]<<bc; bc+=8; }
    const v=bb&((1<<n)-1); bb>>>=n; bc-=n; return v;
  };
  const build=lens=>{
    const counts=new Array(16).fill(0), syms=[];
    lens.forEach(l=>{ if(l>0&&l<=15) counts[l]++; });
    for(let l=1;l<=15;l++) for(let i=0;i<lens.length;i++) if(lens[i]===l) syms.push(i);
    return {counts:counts,syms:syms};
  };
  const huff=t=>{
    let code=0, first=0, index=0;
    for(let len=1;len<=15;len++){
      code|=bits(1);
      const cnt=t.counts[len]||0;
      if(code-first<cnt) return t.syms[index+(code-first)];
      index+=cnt; first=(first+cnt)<<1; code<<=1;
    }
    throw new Error('deflate 霍夫曼码错误');
  };
  const LB=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const LE=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const DB=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const DE=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  let out=new Uint8Array(Math.max(1024,src.length*3)), olen=0;
  const ensure=n=>{ if(olen+n<=out.length) return; const no=new Uint8Array(Math.max(out.length*2,olen+n)); no.set(out.subarray(0,olen)); out=no; };
  const push=v=>{ ensure(1); out[olen++]=v; };
  const copy=(dist,len)=>{ ensure(len); for(let i=0;i<len;i++){ out[olen]=out[olen-dist]; olen++; } };
  let last=false;
  while(!last){
    last=bits(1)===1;
    const type=bits(2);
    if(type===0){
      bb=0; bc=0;
      const len=src[p]|(src[p+1]<<8); p+=4;
      ensure(len); out.set(src.subarray(p,p+len),olen); olen+=len; p+=len;
      continue;
    }
    if(type!==1&&type!==2) throw new Error('不支持的 deflate 块类型');
    let litTree,distTree;
    if(type===1){
      const ll=[]; for(let i=0;i<288;i++) ll.push(i<=143?8:i<=255?9:i<=279?7:8);
      litTree=build(ll); distTree=build(new Array(30).fill(5));
    }else{
      const hlit=bits(5)+257, hdist=bits(5)+1, hclen=bits(4)+4;
      const order=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
      const cl=new Array(19).fill(0);
      for(let i=0;i<hclen;i++) cl[order[i]]=bits(3);
      const clTree=build(cl), lens=[];
      while(lens.length<hlit+hdist){
        const s=huff(clTree);
        if(s<16) lens.push(s);
        else if(s===16){ const prev=lens[lens.length-1]||0, n=bits(2)+3; for(let i=0;i<n;i++) lens.push(prev); }
        else if(s===17){ const n=bits(3)+3; for(let i=0;i<n;i++) lens.push(0); }
        else { const n=bits(7)+11; for(let i=0;i<n;i++) lens.push(0); }
      }
      litTree=build(lens.slice(0,hlit)); distTree=build(lens.slice(hlit));
    }
    for(;;){
      const s=huff(litTree);
      if(s===256) break;
      if(s<256) push(s);
      else{
        const li=s-257; if(li>=LB.length) throw new Error('deflate 长度码错误');
        const len=LB[li]+bits(LE[li]);
        const ds=huff(distTree); if(ds>=DB.length) throw new Error('deflate 距离码错误');
        copy(DB[ds]+bits(DE[ds]),len);
      }
    }
  }
  return out.subarray(0,olen);
};

LL.crc32 = function(buf){
  let t=LL.crc32._t;
  if(!t){ t=LL.crc32._t=new Int32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c; } }
  let c=-1;
  for(let i=0;i<buf.length;i++) c=t[(c^buf[i])&0xFF]^(c>>>8);
  return (c^-1)>>>0;
};
LL.unzip = function(buf){
  buf=buf instanceof Uint8Array?buf:new Uint8Array(buf);
  const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
  let eo=-1;
  for(let i=buf.length-22;i>=Math.max(0,buf.length-65558);i--){ if(dv.getUint32(i,true)===0x06054b50){ eo=i; break; } }
  if(eo<0) throw new Error('不是有效的 .xlsx / ZIP 文件');
  const count=dv.getUint16(eo+10,true), cd=dv.getUint32(eo+16,true);
  const dec=new TextDecoder('utf-8'), files={}; let p=cd;
  for(let k=0;k<count;k++){
    if(p+46>buf.length||dv.getUint32(p,true)!==0x02014b50) break;
    const method=dv.getUint16(p+10,true), csize=dv.getUint32(p+20,true);
    const nlen=dv.getUint16(p+28,true), xlen=dv.getUint16(p+30,true), clen=dv.getUint16(p+32,true);
    const lho=dv.getUint32(p+42,true);
    const name=dec.decode(buf.subarray(p+46,p+46+nlen));
    const lnlen=dv.getUint16(lho+26,true), lxlen=dv.getUint16(lho+28,true);
    const start=lho+30+lnlen+lxlen, raw=buf.subarray(start,start+csize);
    if(method===0) files[name]=raw;
    else if(method===8) files[name]=LL.inflateRaw(raw);
    p+=46+nlen+xlen+clen;
  }
  return files;
};
LL.zipStore = function(entries){
  const enc=new TextEncoder(), dec=new Uint8Array(0);
  const parts=[], central=[]; let offset=0;
  const u16=(a,v)=>{a.push(v&255,(v>>>8)&255)};
  const u32=(a,v)=>{a.push(v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255)};
  entries.forEach(e=>{
    const name=enc.encode(e.name), data=e.data||dec, crc=LL.crc32(data);
    const local=[]; u32(local,0x04034b50); u16(local,20); u16(local,0); u16(local,0); u16(local,0); u16(local,0);
    u32(local,crc); u32(local,data.length); u32(local,data.length); u16(local,name.length); u16(local,0);
    const lh=new Uint8Array(local.length+name.length); lh.set(local); lh.set(name,local.length);
    parts.push(lh,data);
    const cd=[]; u32(cd,0x02014b50); u16(cd,20); u16(cd,20); u16(cd,0); u16(cd,0); u16(cd,0); u16(cd,0);
    u32(cd,crc); u32(cd,data.length); u32(cd,data.length); u16(cd,name.length); u16(cd,0); u16(cd,0);
    u16(cd,0); u16(cd,0); u32(cd,0); u32(cd,offset);
    const ce=new Uint8Array(cd.length+name.length); ce.set(cd); ce.set(name,cd.length);
    central.push(ce); offset+=lh.length+data.length;
  });
  const cdSize=central.reduce((s,x)=>s+x.length,0);
  const eocd=[]; u32(eocd,0x06054b50); u16(eocd,0); u16(eocd,0); u16(eocd,entries.length); u16(eocd,entries.length);
  u32(eocd,cdSize); u32(eocd,offset); u16(eocd,0);
  const all=parts.concat(central,[new Uint8Array(eocd)]);
  const total=all.reduce((s,x)=>s+x.length,0), out=new Uint8Array(total);
  let q=0; all.forEach(x=>{out.set(x,q);q+=x.length});
  return out;
};

/* 轻量 XML：只解析元素 / 属性 / 文本，够 xlsx 用，不依赖 DOMParser */
LL._xmlDecode = function(s){
  const map={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g,(m,e)=>{
    if(e[0]==='#'){ const n=e[1]==='x'||e[1]==='X'?parseInt(e.slice(2),16):parseInt(e.slice(1),10); try{return String.fromCodePoint(n);}catch(_){return m;} }
    return map[e]!==undefined?map[e]:m;
  });
};
LL._xml = function(s){
  const root={n:'#doc',a:{},c:[],t:''}, st=[root]; let i=0;
  while(i<s.length){
    const lt=s.indexOf('<',i);
    if(lt<0){ st[st.length-1].t+=LL._xmlDecode(s.slice(i)); break; }
    if(lt>i) st[st.length-1].t+=LL._xmlDecode(s.slice(i,lt));
    if(s.substr(lt,4)==='<!--'){ const e=s.indexOf('-->',lt); if(e<0)break; i=e+3; continue; }
    if(s.substr(lt,9)==='<![CDATA['){ const e=s.indexOf(']]>',lt); if(e<0)break; st[st.length-1].t+=s.slice(lt+9,e); i=e+3; continue; }
    const gt=s.indexOf('>',lt); if(gt<0) break;
    let tag=s.slice(lt+1,gt); i=gt+1;
    if(tag[0]==='?'||tag[0]==='!') continue;
    const closing=tag[0]==='/';
    if(closing){ if(st.length>1) st.pop(); continue; }
    const self=tag[tag.length-1]==='/';
    if(self) tag=tag.slice(0,-1);
    const m=tag.match(/^([\w:.-]+)([\s\S]*)$/); if(!m) continue;
    const node={n:m[1].replace(/^.*:/,''),a:{},c:[],t:''};
    const ar=/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g; let am;
    while((am=ar.exec(m[2]))) node.a[am[1].replace(/^.*:/,'')]=LL._xmlDecode(am[3]!==undefined?am[3]:am[4]);
    st[st.length-1].c.push(node);
    if(!self) st.push(node);
  }
  return root;
};
LL._find = function(node,name,out){ out=out||[]; node.c.forEach(c=>{ if(c.n===name) out.push(c); LL._find(c,name,out); }); return out; };
LL._first = function(node,name){ return LL._find(node,name)[0]||null; };
LL._text = function(node){ let t=node.t||''; node.c.forEach(c=>t+=LL._text(c)); return t; };
LL._colIdx = function(ref){
  const m=String(ref||'').match(/^([A-Za-z]+)/); if(!m) return -1;
  let n=0; const s=m[1].toUpperCase();
  for(let i=0;i<s.length;i++) n=n*26+(s.charCodeAt(i)-64);
  return n-1;
};
LL._serialToDate = function(v){
  const days=Math.floor(v), frac=v-days;
  const d=new Date(1899,11,30); d.setDate(d.getDate()+days);
  let s=LL.fmtDate(d);
  const mins=Math.round(frac*1440);
  if(mins>0) s+=' '+LL.pad(Math.floor(mins/60)%24)+':'+LL.pad(mins%60);
  return s;
};

LL.parseXLSX = function(buf, sheetIdx){
  buf=buf instanceof Uint8Array?buf:new Uint8Array(buf);
  const files=LL.unzip(buf), dec=new TextDecoder('utf-8');
  const xml=n=>files[n]?LL._xml(dec.decode(files[n])):LL._xml('');
  // 共享字符串
  const ss=LL._find(xml('xl/sharedStrings.xml'),'si').map(n=>LL._text(n));
  // 单元格样式：找出「日期格式」的 xf 序号
  const styles=xml('xl/styles.xml'), custom={};
  LL._find(styles,'numFmt').forEach(n=>{ if(n.a.numFmtId) custom[n.a.numFmtId]=n.a.formatCode||''; });
  const DATE_IDS=[14,15,16,17,18,19,20,21,22,27,28,29,30,31,32,33,34,35,36,45,46,47,50,51,52,53,54,55,56,57,58];
  const isDate=id=>{
    if(DATE_IDS.indexOf(+id)>=0) return true;
    const c=custom[String(id)]||'';
    return /[ymdhs]/i.test(c.replace(/\[[^\]]*\]/g,'').replace(/"[^"]*"/g,'')) && !/^[#0.,%\s]+$/.test(c);
  };
  const xfs=LL._first(styles,'cellXfs'), dateXfs=new Set();
  if(xfs) LL._find(xfs,'xf').forEach((x,i)=>{ if(isDate(x.a.numFmtId)) dateXfs.add(i); });
  // 工作表名与关系
  const wb=xml('xl/workbook.xml'), sheets=LL._find(wb,'sheet');
  const sheetNames=sheets.map(s=>s.a.name||('Sheet'+(sheets.indexOf(s)+1)));
  const idx=Math.max(0,Math.min(sheetIdx||0,sheetNames.length-1||0));
  const rels=xml('xl/_rels/workbook.xml.rels'), relMap={};
  LL._find(rels,'Relationship').forEach(r=>{ if(r.a.Id) relMap[r.a.Id]=r.a.Target||''; });
  let target=relMap[sheets[idx]&&(sheets[idx].a.id||sheets[idx].a.rId||sheets[idx].a.Id)]||'';
  if(target.startsWith('/')) target=target.slice(1);
  else if(!target.startsWith('xl/')) target='xl/'+target;
  if(!files[target]) target='xl/worksheets/sheet'+(idx+1)+'.xml';
  // 单元格
  const sh=xml(target), all=[];
  LL._find(sh,'row').forEach(row=>{
    const arr=[];
    LL._find(row,'c').forEach(c=>{
      const ci=LL._colIdx(c.a.r); if(ci<0) return;
      const t=c.a.t||'', vNode=LL._first(c,'v'), v=vNode?LL._text(vNode):'';
      let val='';
      if(t==='s') val=ss[parseInt(v,10)]||'';
      else if(t==='inlineStr'){ const is=LL._first(c,'is'); val=is?LL._text(is):''; }
      else if(t==='b') val=(v==='1'?'TRUE':'FALSE');
      else if(t==='d') val=v;
      else if(t==='str'||t==='e') val=v;
      else if(v!==''){
        const num=parseFloat(v);
        val=(dateXfs.has(parseInt(c.a.s||'-1',10))&&!isNaN(num))?LL._serialToDate(num):v;
      }
      arr[ci]=String(val);
    });
    for(let i=0;i<arr.length;i++) if(arr[i]===undefined) arr[i]='';
    if(arr.some(x=>x!=='')) all.push(arr);
  });
  if(!all.length) return {headers:[],rows:[],sheetNames:sheetNames,sheetName:sheetNames[idx]||'',sheetIndex:idx,kind:'xlsx'};
  const width=Math.max.apply(null,all.map(r=>r.length));
  const headers=all[0].slice(0,width).map((h,i)=>h||('列'+(i+1)));
  while(headers.length<width) headers.push('列'+(headers.length+1));
  const rows=all.slice(1).map(r=>{const x=r.slice(0,width);while(x.length<width)x.push('');return x;});
  return {headers:headers,rows:rows,sheetNames:sheetNames,sheetName:sheetNames[idx]||'',sheetIndex:idx,kind:'xlsx'};
};

/* 生成一份双工作表的示例 .xlsx（stored ZIP），用于「下载 → 再导入」闭环演示 */
LL.buildSampleXLSX = function(){
  const enc=new TextEncoder();
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const demo=LL.generateDemoData('2026-11-08',7).filter(r=>r.amount>0&&r.direction==='收入').slice(0,60);
  const head=['交易日期','交易时间','单据编号','实收金额','成本金额','交易类型','结算方式','商品分类','门店名称','业态'];
  const rows=demo.map(r=>[r.date+'T'+r.time+':00',r.time,r.orderNo,String(r.amount),r.cost!=null?String(r.cost):'',r.direction,r.payMethod,r.category,r.store,(LL.BIZ[r.biz]?LL.BIZ[r.biz].name:'')]);
  const cell=(ref,val,isNum)=>'<c r="'+ref+'"'+(isNum?'':' t="inlineStr"')+'>'+(isNum?'<v>'+esc(val)+'</v>':'<is><t>'+esc(val)+'</t></is>')+'</c>';
  const colName=n=>{let s='';n++;while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;};
  const sheetXml=(data,dateCol)=>{
    const body=data.map((row,ri)=>'<row r="'+(ri+1)+'">'+row.map((v,ci)=>{
      if(dateCol && ri>0 && ci===0 && v) return '<c r="'+colName(ci)+(ri+1)+'" t="d"><v>'+esc(v)+'</v></c>';
      const isNum=!dateCol?false:(ri>0&&(ci===3||ci===4)&&v!=='');
      return cell(colName(ci)+(ri+1),v,isNum);
    }).join('')+'</row>').join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+body+'</sheetData></worksheet>';
  };
  const notes=[['字段','说明'],['交易日期','ISO 日期，验证 .xlsx 日期单元格解析'],['实收金额','正向收入'],['成本金额','成本；系统据此计算毛利额 / 毛利率'],['业态','超市 / 药店 / 酒店'],['提示','本文件由「下载示例 XLSX」生成，可拖回左侧导入体验']];
  const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="日结流水" sheetId="1" r:id="rId1"/><sheet name="字段说明" sheetId="2" r:id="rId2"/></sheets></workbook>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const rootRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
  const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0"/></cellXfs></styleSheet>';
  const entries=[['[Content_Types].xml',ct],['_rels/.rels',rootRels],['xl/workbook.xml',wb],['xl/_rels/workbook.xml.rels',rels],['xl/styles.xml',styles],
    ['xl/worksheets/sheet1.xml',sheetXml([head].concat(rows),true)],['xl/worksheets/sheet2.xml',sheetXml(notes,false)]];
  return LL.zipStore(entries.map(e=>({name:e[0],data:enc.encode(e[1])})));
};


/* ===== core/mapping.js ===== */

/* ---------- 自动字段映射 ---------- */
LL.guessMapping = function(headers){
  const norm=headers.map(LL.normalizeHeader);
  const pairs=[];
  LL.FIELD_DEFS.forEach((def,fi)=>{
    const aliasNorm=def.aliases.map(LL.normalizeHeader);
    norm.forEach((h,i)=>{
      if(!h) return;
      let s=0;
      for(const a of aliasNorm){
        if(!a) continue;
        if(h===a){ s=100; break; }
        if(h.indexOf(a)>=0 || a.indexOf(h)>=0) s=Math.max(s,55+Math.min(a.length,h.length)*2);
      }
      if(s===0){
        const kw={date:['日期','date','时间'],amount:['金额','amount','价','money','总额','应收'],
          payMethod:['支付','付款','结算','渠道','pay'],store:['店','铺','门','机构','商户'],
          category:['分类','类别','大类','部门','科目'],orderNo:['单','号','流水','order','id'],
          item:['商品','品名','摘要','明细','说明','备注'],qty:['数量','件','份','qty'],
          member:['会员','客户','卡号','vip'],direction:['方向','类型','状态','type'],
          biz:['业态','行业','business'],time:['时分','时刻','clock'],
          cost:['成本','进货','进价','cogs'],unitCost:['单位成本','单件成本','costper'],
          grossProfit:['毛利','gross','margin'],unitPrice:['单价','unitprice']}[def.key]||[];
        if(kw.some(k=>h.indexOf(k)>=0)) s=34;
      }
      if(s>0) pairs.push({key:def.key,i:i,s:s,fi:fi});
    });
  });
  // 高分优先（精确命中 100 分 > 包含命中 > 关键词兜底），同分按字段定义顺序
  pairs.sort((a,b)=>b.s-a.s || a.fi-b.fi || a.i-b.i);
  const usedH=new Set(), usedF=new Set(), map={};
  for(const p of pairs){
    if(usedH.has(p.i)||usedF.has(p.key)||p.s<30) continue;
    map[p.key]=p.i; usedH.add(p.i); usedF.add(p.key);
  }
  if(map.amount===undefined) map.amount=-1;
  if(map.date===undefined) map.date=-1;
  return map;
};

LL.applyMapping = function(parsed, mapping, meta){
  meta = meta||{};
  const H=parsed.headers, R=parsed.rows;
  const get=(row,key)=>{ const i=mapping[key]; return (i===undefined||i<0||i>=row.length)?'':row[i]; };
  const recs=[], warn=[]; let skipped=0, synthesized=0, costSynthesized=0, costFilled=0, salesLike=0;
  const dateIdx=mapping.date;
  const noAmount=(mapping.amount===undefined||mapping.amount<0);
  for(let r=0;r<R.length;r++){
    const row=R[r];
    let date=LL.cleanDate(get(row,'date'));
    let amount=LL.cleanAmount(get(row,'amount'));
    const unitPrice=LL.cleanAmount(get(row,'unitPrice'));
    const qtyVal=LL.cleanAmount(get(row,'qty'));
    let costVal=LL.cleanAmount(get(row,'cost'));
    const unitCost=LL.cleanAmount(get(row,'unitCost'));
    const gpVal=LL.cleanAmount(get(row,'grossProfit'));
    // 真实 POS 导出常只给「数量 + 单价」而不给行金额：自动合成，保留取消单的负号
    if(isNaN(amount) && !isNaN(unitPrice) && !isNaN(qtyVal)){
      amount=LL.round(unitPrice*qtyVal,2); synthesized++;
    }
    if(!date) { skipped++; continue; }
    if(isNaN(amount)) { skipped++; continue; }
    let dirRaw=String(get(row,'direction')||'').trim();
    let direction='收入';
    const refundFlag=/退|返|refund|return|冲|撤销|负|支出|费用|采购|成本|expense|out/i.test(dirRaw)
                 || /^(1|true|yes|y|是|void|cancel|cancelled|退款|退货)$/i.test(dirRaw);
    if(refundFlag) direction=/支出|费用|采购|成本|expense/.test(dirRaw)?'支出':'退款';
    else if(amount<0) direction='退款';
    if(direction!=='收入' && amount>0) amount=-amount; // 方向列优先
    // 成本口径：正数表示「已发生的商品成本」；退款行的成本代表冲回，支出行不参与毛利
    if(direction!=='支出'){
      salesLike++;
      if(isNaN(costVal) && !isNaN(unitCost) && !isNaN(qtyVal)){
        costVal=unitCost*Math.abs(qtyVal); costSynthesized++;
      }
      if(isNaN(costVal) && !isNaN(gpVal) && direction==='收入'){
        costVal=amount-gpVal; // 有毛利额列时可反推成本
      }
      if(!isNaN(costVal)){ costVal=Math.abs(costVal); costFilled++; }
    }
    if(direction==='支出' || isNaN(costVal)) costVal=null;
    const dateVal=dateIdx>=0?row[dateIdx]:'';
    let time=LL.cleanTime(get(row,'time'), dateVal);
    if(!time) time='00:00';
    const qtyRaw=qtyVal;
    const bizRaw=String(get(row,'biz')||'').trim();
    const bizAlias={'超市':'supermarket','商超':'supermarket','便利店':'supermarket','药店':'pharmacy','药房':'pharmacy','酒店':'hotel','宾馆':'hotel','旅馆':'hotel'};
    const bizVal=bizAlias[bizRaw]||(LL.BIZ[bizRaw]?bizRaw:(bizRaw||meta.biz||'imported'));
    recs.push({
      date:date, time:time,
      orderNo:String(get(row,'orderNo')||('IMP-'+date.replace(/-/g,'')+'-'+String(r+1).padStart(5,'0'))).trim(),
      amount:LL.round(amount,2), cost:costVal===null?null:LL.round(costVal,2), direction:direction,
      payMethod:String(get(row,'payMethod')||'未标注').trim()||'未标注',
      category:String(get(row,'category')||'未分类').trim()||'未分类',
      item:String(get(row,'item')||'').trim(),
      qty:(isNaN(qtyRaw)||qtyRaw<=0)?1:Math.abs(qtyRaw),
      store:String(get(row,'store')||meta.store||'未标注门店').trim()||'未标注门店',
      biz:bizVal,
      member:String(get(row,'member')||'').trim(),
      src:meta.source||'导入'
    });
  }
  if(synthesized) warn.push('已按「数量 × 单价」合成 '+synthesized+' 行金额');
  if(costSynthesized) warn.push('已按「数量 × 单位成本」合成 '+costSynthesized+' 行成本');
  if(salesLike && !costFilled) warn.push('未检测到成本列：毛利额 / 毛利率将显示为「—」，可映射成本金额、单位成本或毛利额列');
  else if(salesLike && costFilled<salesLike) warn.push('仅 '+LL.pct(costFilled/salesLike)+' 的记录带成本，毛利率只基于这部分计算');
  if(skipped) warn.push('跳过 '+skipped+' 行（日期或金额无法识别）');
  if(mapping.date===undefined||mapping.date<0) warn.push('未找到日期列');
  if(noAmount && !synthesized){
    warn.push('未找到金额列：请手动指定金额列，或提供「数量 + 单价」两列自动合成；若每个品类各自一列（宽表），需先逆透视成行级流水');
    if(mapping.qty!==undefined && mapping.qty>=0) warn.push('检测到数量列但没有任何金额 / 单价列：这份文件可能只记录了销量件数。若确实没有价格，可把上方「金额」手动指向数量列，按件数口径分析（此时所有「金额」应理解为件数，请勿据此做毛利判断）');
  }
  return {records:recs,warnings:warn};
};


/* ===== core/analytics.js ===== */

/* ---------- 分析计算 ---------- */
LL.computeAnalytics = function(records, f){
  f=f||{};
  const R=LL.RULES;
  const from=f.from||'0000-01-01', to=f.to||'9999-12-31';
  const rows=records.filter(r=>
    r.date>=from && r.date<=to &&
    (!f.biz||f.biz==='all'||r.biz===f.biz) &&
    (!f.store||r.store===f.store) &&
    (!f.pay||r.payMethod===f.pay) &&
    (!f.category||r.category===f.category) &&
    (f.weekday==null||f.weekday===''||LL.weekday(r.date)===Number(f.weekday)) &&
    (f.hour==null||f.hour===''||parseInt(String(r.time).split(':')[0],10)===Number(f.hour))
  );
  const pos=rows.filter(r=>r.amount>0 && r.direction==='收入');
  const refunds=rows.filter(r=>r.direction==='退款');
  const expenses=rows.filter(r=>r.direction==='支出');
  const sales=LL.sum(pos,r=>r.amount);
  const refund=LL.sum(refunds,r=>Math.abs(r.amount));
  const expense=LL.sum(expenses,r=>Math.abs(r.amount));
  const net=sales-refund-expense;
  const orders=new Set(pos.map(r=>r.orderNo)).size;

  // 商品毛利：只统计「带成本的销售 / 退款行」，退款行按成本冲回
  // 成本缺失的行不按 0 成本处理，避免毛利率虚高；覆盖率单独披露
  const profitOf=r=>{
    if(r.cost==null||r.direction==='支出') return null;
    return r.direction==='退款' ? (r.amount+r.cost) : (r.amount-r.cost);
  };
  const costRows=rows.filter(r=>profitOf(r)!==null);
  const grossProfit=LL.sum(costRows,profitOf);
  const coveredSales=LL.sum(costRows,r=>r.amount);
  const grossMargin=coveredSales>0?grossProfit/coveredSales:null;
  const costTotal=LL.sum(costRows,r=>r.direction==='退款'?-r.cost:r.cost);
  const saleLike=rows.filter(r=>r.direction!=='支出').length;
  const costCoverage=saleLike?costRows.length/saleLike:0;
  const hasCost=costRows.length>0;

  const dateSet=new Set(rows.map(r=>r.date));
  const dates=[...dateSet].sort();
  const allDates=[];
  if(dates.length){ let d=dates[0]; while(d<=dates[dates.length-1]){ allDates.push(d); d=LL.addDays(d,1); } if(allDates.length>400) allDates.splice(0,allDates.length-400); }
  const byDate={}; allDates.forEach(d=>byDate[d]={net:0,sales:0,profit:0,orders:new Set()});
  rows.forEach(r=>{
    if(!byDate[r.date]) return;
    byDate[r.date].net += r.amount;
    const pr=profitOf(r); if(pr!==null) byDate[r.date].profit += pr;
    if(r.amount>0&&r.direction==='收入'){ byDate[r.date].sales+=r.amount; byDate[r.date].orders.add(r.orderNo); }
  });
  const daily=allDates.map(d=>({date:d,net:byDate[d].net,sales:byDate[d].sales,profit:byDate[d].profit,orders:byDate[d].orders.size}));

  // 环比：优先用「最近 N 个整周 vs 之前 N 个整周」，两段星期分布一致，
  // 避免奇数天数 / 节假日错位把周末效应误判成增长或下滑。不足整周时退回半段切分。
  let prev={net:0,orders:0,avgTicket:0,profit:0}, curr={net:0,orders:0,avgTicket:0,profit:0};
  let span=Math.floor(Math.floor(daily.length/2)/7)*7;
  let compareMode='后半段 vs 前半段';
  if(span>=7 && daily.length>=span*2){
    const a=daily.slice(daily.length-2*span,daily.length-span), b=daily.slice(daily.length-span);
    prev.net=LL.sum(a,x=>x.net); prev.orders=LL.sum(a,x=>x.orders); prev.profit=LL.sum(a,x=>x.profit);
    curr.net=LL.sum(b,x=>x.net); curr.orders=LL.sum(b,x=>x.orders); curr.profit=LL.sum(b,x=>x.profit);
    compareMode='最近 '+span+' 天 vs 前 '+span+' 天（整周对齐）';
  }else if(daily.length>=4){
    const half=Math.floor(daily.length/2);
    const a=daily.slice(0,half), b=daily.slice(half);
    prev.net=LL.sum(a,x=>x.net); prev.orders=LL.sum(a,x=>x.orders); prev.profit=LL.sum(a,x=>x.profit);
    curr.net=LL.sum(b,x=>x.net); curr.orders=LL.sum(b,x=>x.orders); curr.profit=LL.sum(b,x=>x.profit);
    compareMode='后半段 vs 前半段（不足整周，仅供参考）';
  }else{
    prev.net=curr.net=net; prev.orders=curr.orders=orders; curr.profit=prev.profit=grossProfit;
    compareMode='数据不足，未做环比';
  }
  prev.avgTicket=prev.orders?prev.net/prev.orders:0;
  curr.avgTicket=curr.orders?curr.net/curr.orders:0;

  // 分组
  const groupSum=function(key,filterFn,valFn){
    const m={};
    rows.filter(filterFn||(()=>true)).forEach(r=>{ const k=r[key]||'未分类'; m[k]=(m[k]||0)+(valFn?valFn(r):r.amount); });
    return Object.entries(m).map(([label,value])=>({label:label,value:value})).sort((a,b)=>b.value-a.value);
  };
  const payArr=groupSum('payMethod',r=>r.amount>0&&r.direction==='收入');
  const catArr=groupSum('category',r=>r.amount>0&&r.direction==='收入');
  const storeArr=groupSum('store',()=>true,r=>r.amount);
  const bizArr=groupSum('biz',()=>true,r=>r.amount);
  const refundArr=groupSum('category',r=>r.direction==='退款',r=>Math.abs(r.amount));
  // 毛利分组：value=毛利额，sales=对应净销售额，margin=该组毛利率
  const profitBy=key=>{
    const m={};
    costRows.forEach(r=>{
      const k=r[key]||'未分类';
      if(!m[k]) m[k]={label:k,value:0,sales:0};
      m[k].value+=profitOf(r); m[k].sales+=r.amount;
    });
    return Object.keys(m).map(k=>({label:m[k].label,value:m[k].value,sales:m[k].sales,
      margin:m[k].sales>0?m[k].value/m[k].sales:0})).sort((a,b)=>b.value-a.value);
  };
  const catProfitArr=profitBy('category');
  const storeProfitArr=profitBy('store');
  // 业态化退款参考线：多业态混合用通用值，单一业态用行业值（药店天然高于酒店）
  const bizCount=bizArr.filter(b=>b.value>0).length;
  const hasRoom=catArr.some(c=>/房费|客房|住宿/.test(c.label));
  const hasMedical=payArr.some(p=>/医保|社保|统筹/.test(p.label));
  const refundLimit=bizCount>1?R.refundMixed:(hasRoom?R.refundHotel:(hasMedical?R.refundPharmacy:R.refundMarket));

  const hourly=new Array(24).fill(0);
  rows.filter(r=>r.amount>0&&r.direction==='收入').forEach(r=>{ const h=parseInt(String(r.time).split(':')[0],10); if(!isNaN(h)&&h>=0&&h<24) hourly[h]+=r.amount; });
  const weekSum=new Array(7).fill(0), weekCnt=new Array(7).fill(0);
  daily.forEach(d=>{ const w=LL.weekday(d.date); weekSum[w]+=d.net; weekCnt[w]++; });
  const weekAvg=weekSum.map((v,i)=>weekCnt[i]?v/weekCnt[i]:0);

  const nets=daily.map(d=>d.net), mean=LL.avg(nets), sd=LL.std(nets);
  const cv=mean?sd/Math.abs(mean):0;
  const peakDay=daily.length?daily.reduce((a,b)=>a.net>b.net?a:b):null;
  const lowDay=daily.length?daily.reduce((a,b)=>a.net<b.net?a:b):null;

  const posAmts=pos.map(r=>r.amount), pa=LL.avg(posAmts), ps=LL.std(posAmts);
  const bigThreshold=pa+R.sigmaOrder*ps;
  const bigOrders=pos.filter(r=>r.amount>bigThreshold).sort((a,b)=>b.amount-a.amount).slice(0,8);
  const waveDaysRaw = daily.filter(d=>sd>0 && Math.abs(d.net-mean)>R.sigmaDay*sd).map(d=>({date:d.date,net:d.net,diff:mean?(d.net-mean)/Math.abs(mean):0}));

  const lateNight=hourly.slice(22).concat(hourly.slice(0,6)).reduce((a,b)=>a+b,0);
  const totalHour=LL.sum(hourly);
  const lateRatio=totalHour?lateNight/totalHour:0;
  const topPayShare=payArr.length?payArr[0].value/LL.sum(payArr,x=>x.value):0;
  const catTotal=LL.sum(catArr,x=>x.value);
  const catConcentration=catTotal?catArr[0].value/catTotal:0;
  const refundRate=sales?refund/sales:0;
  const weekdayAvg=LL.avg(weekAvg.slice(0,5).filter((v,i)=>weekCnt[i]>0));
  const weekendAvg=LL.avg(weekAvg.slice(5).filter((v,i)=>weekCnt[i+5]>0));
  // 末尾连续走弱天数
  let tailDown=0; for(let i=daily.length-1;i>=0;i--){ if(daily[i].net<mean) tailDown++; else break; }

  return {
    rows:rows, daily:daily, dates:allDates, sales:sales, refund:refund, expense:expense, net:net, orders:orders,
    avgTicket:orders?net/orders:0, refundRate:refundRate, refundLimit:refundLimit,
    compareMode:compareMode, compareDays:span, dayCount:allDates.length,
    dailyAvg:allDates.length?net/allDates.length:0, cv:cv, mean:mean, sd:sd,
    hasCost:hasCost, costTotal:costTotal, grossProfit:grossProfit, grossMargin:grossMargin,
    coveredSales:coveredSales, costCoverage:costCoverage,
    costRowCount:costRows.length, saleLikeCount:saleLike,
    payArr:payArr, catArr:catArr, storeArr:storeArr, bizArr:bizArr, refundArr:refundArr,
    catProfitArr:catProfitArr, storeProfitArr:storeProfitArr,
    hourly:hourly, weekAvg:weekAvg, weekCnt:weekCnt, weekdayAvg:weekdayAvg, weekendAvg:weekendAvg,
    peakDay:peakDay, lowDay:lowDay, bigOrders:bigOrders, bigThreshold:bigThreshold,
    waveDays:waveDaysRaw, lateRatio:lateRatio, topPayShare:topPayShare, catConcentration:catConcentration,
    prev:prev, curr:curr, tailDown:tailDown,
    chgNet:prev.net?(curr.net-prev.net)/Math.abs(prev.net):0,
    chgTicket:prev.avgTicket?(curr.avgTicket-prev.avgTicket)/prev.avgTicket:0,
    chgOrders:prev.orders?(curr.orders-prev.orders)/prev.orders:0,
    chgProfit:prev.profit?(curr.profit-prev.profit)/Math.abs(prev.profit):0
  };
};


/* ===== core/suggestions.js ===== */

/* ---------- 建议引擎 ---------- */
LL.buildSuggestions = function(ctx, biz){
  const S=[]; const M=LL.money, P=LL.pct; const R=LL.RULES;
  const add=(level,title,evidence,advice,onlyBiz,focus,tag)=>{
    if(onlyBiz && onlyBiz!=='all' && biz!=='all' && biz!==onlyBiz) return;
    S.push({level:level,title:title,evidence:evidence,advice:advice,focus:focus||'',tag:tag||'总体'});
  };
  // 从账目内容本身推断业态，不依赖「来自哪个系统」的标记
  const hasRoom=ctx.catArr.some(c=>/房费|客房|住宿/.test(c.label));
  const hasMedical=ctx.payArr.some(p=>/医保|社保|统筹/.test(p.label));
  const hasFresh=ctx.catArr.some(c=>/生鲜|果蔬|肉禽/.test(c.label));
  const pctAbs=v=>P(Math.abs(v));

  if(ctx.chgTicket<-R.ticketDrop){
    add('high','客人每次花的钱变少了','最近这段时间，平均每位客人花 '+M(ctx.curr.avgTicket)+'；上一段是 '+M(ctx.prev.avgTicket)+'，少了 '+pctAbs(ctx.chgTicket)+'。',
      '先分清是「买的东西少了」还是「买的东西变便宜了」：如果件数没变、只是单价低了，多半是打折多了，或者便宜货卖得多了。可以把满减门槛设在 '+M(ctx.avgTicket*1.2,true)+' 左右（比现在平均消费高一点），再把贵一点的东西摆在一起卖。','all','boxTrend','客人花钱');
  }

  if(ctx.chgNet<-R.netChange){
    add('high','最近生意比前一段时间淡了','最近进账 '+M(ctx.curr.net,true)+'，比上一段的 '+M(ctx.prev.net,true)+' 少了 '+pctAbs(ctx.chgNet)+'；单数变化 '+P(ctx.chgOrders)+'。',
      '先分清是「客人少了」还是「每位客人花得少了」：单数掉得多就去查客流和营业时间，客单掉得多就去查商品和价格。顺便看看这几天有没有缺货、机器出故障，或者隔壁在搞活动。','all','boxTrend','生意走势');
  }
  if(ctx.chgNet>R.netChange){
    add('good','最近生意比前一段时间好了','最近进账 '+M(ctx.curr.net,true)+'，比上一段多了 '+P(ctx.chgNet)+'；平均每天 '+M(ctx.dailyAvg,true)+'。',
      '把这次做对的事记下来：看看是哪类东西、哪个时段涨的，是搞活动带起来的还是自然来的。确认有效后排进下个月的安排，别让好势头只火一阵。','all','boxTrend','生意走势');
  }

  const refundLine = ctx.refundLimit || R.refundMixed;
  if(ctx.refundRate>1){
    add('high','退回去的钱比收进来的还多，先别急着下结论','退款记了 '+M(ctx.refund,true)+'，收入记了 '+M(ctx.sales,true)+'，算出来 '+P(ctx.refundRate)+'。这多半不是真退多了，而是表里把「根本没收到钱的取消单」也算成退款，或者金额本来就是负数、又标了一次「退」，等于减了两遍。',
      '把「压根没收到钱的取消单」挑出来单独放，既不记收入也不记退款；再检查金额那一列的正负号，和「收 / 退」那一列是不是说了同一件事。改完之后再看下面的数字。','all','boxRefund','账要核准');
  }
  else if(ctx.refundRate>refundLine){
    const top=ctx.refundArr[0];
    add('high','退回去的钱有点多','一共退了 '+M(ctx.refund,true)+'，占收进来的 '+P(ctx.refundRate)+'，这类生意一般在 '+P(refundLine)+' 以内'+(top?'；退得最多的是「'+top.label+'」'+M(top.value,true):'')+'。',
      '把退得最多的那类单子翻出来，按门店、商品、班次看一遍：是收银员录错单、重复收了钱，还是东西有问题、缺货。让收银台退款时必填一个原因，一周后再看看有没有降下来。','all','boxRefund','退款');
  }

  // ---- 成本 / 毛利 ----
  let gmRef;
  const gmByName={'超市':R.gmMarket,'药店':R.gmPharmacy,'酒店':R.gmHotel};
  const gmByKey={supermarket:R.gmMarket,pharmacy:R.gmPharmacy,hotel:R.gmHotel};
  if(gmByKey[biz]!==undefined) gmRef=gmByKey[biz];
  else{
    const active=ctx.bizArr.filter(b=>b.value>0 && (gmByName[b.label]||gmByKey[b.label]));
    const total=LL.sum(active,x=>x.value);
    gmRef=total ? LL.sum(active,x=>x.value*(gmByName[x.label]||gmByKey[x.label]||R.gmMarket))/total
                : (hasRoom?R.gmHotel:(hasMedical?R.gmPharmacy:R.gmMarket));
  }
  if(!ctx.hasCost){
    add('low','这份表没写进价，暂时算不出赚了多少','一共读进来 '+ctx.rows.length.toLocaleString('zh-CN')+' 笔账，但没有一笔写了进价、单位进价或毛利。收了多少钱、退了多少，这些照样能看。',
      '放文件的时候，在确认栏目那一步把「成本金额」「单位成本」或「毛利额」指到对应那一列就行。如果你的收银系统根本不导出进价，可以先按品类整理一张进价表，在 Excel 里补一列再放进来。','all','boxProfit','赚的差价');
  }else{
    if(ctx.costCoverage<R.costCoverage){
      add('low','只有一部分账记了进价，看赚多少时要留意','记了进价的有 '+ctx.costRowCount.toLocaleString('zh-CN')+' 笔，占 '+LL.pct(ctx.costCoverage)+'（一共 '+ctx.saleLikeCount.toLocaleString('zh-CN')+' 笔卖货记录）。赚的差价只按这些算，没记进价的先放在一边，不会当成「不要钱」。',
        '看看没记进价的是不是都集中在某家店、某类商品或某几天。如果是导出漏了，补齐再跑一遍；如果本来就不记，那每次看「赚多少」都带上这个「只有几成有进价」的说明，别拿它跟总营业额直接比。','all','boxProfit','赚的差价');
    }
    if(ctx.grossMargin!==null && ctx.grossMargin<gmRef){
      add('high','卖东西赚到的差价偏少','有进价的那部分账：收了 '+M(ctx.coveredSales,true)+'，进货花掉 '+M(ctx.costTotal,true)+'，差价 '+M(ctx.grossProfit,true)+'。相当于每收 100 元，只有 '+P(ctx.grossMargin)+' 元是差价；这类生意一般能有 '+P(gmRef)+' 左右。',
        '按品类拆开看，先分清哪些是「本来就不太赚、专门用来招客人的」，哪些是「价格标错了 / 进价涨了」。再查打折、赠品、退货有没有把进货成本算重。优先管赚的差价金额最大的两三类，别只盯着百分比。','all','boxProfit','赚的差价');
    }
    const losers=ctx.catProfitArr.filter(c=>c.value<0);
    if(losers.length){
      add('high','有几类东西是卖一件亏一件','一共 '+losers.length+' 类东西卖价还没进价高，最明显的是「'+losers[0].label+'」，亏了 '+M(losers[0].value,true)+'，这类一共卖了 '+M(losers[0].sales,true)+'。',
        '先翻几笔单子核对：是不是把进价填成售价了、把「一个的进价」当成「整单成本」了，或者客人退货时没把成本退回来。确认不是填错，再考虑停卖、涨价，或者跟别的东西搭着卖。','all','boxProfit','赚的差价');
    }
    const topSales=ctx.catArr.slice(0,3);
    const lowGm=ctx.catProfitArr.filter(c=>c.margin<gmRef*0.6 && topSales.some(t=>t.label===c.label));
    if(lowGm.length){
      add('mid','最卖钱的几类，其实不太赚','「'+lowGm.map(c=>c.label+' 差价占比 '+P(c.margin)).join('」「')+'」既是卖得最多的前三名，差价占比又比正常水平低不少。',
        '这种多半是专门把客人引进来的便宜货，别拿「赚多少」单独考核它。看看买了它的人有没有顺手买别的更赚钱的东西，再决定是继续低价、少摆一点，还是做成搭配套餐。','all','boxCat','卖的东西');
    }
    if(ctx.chgProfit<-R.profitDrop && ctx.curr.profit>0){
      add('mid','赚的差价掉得比营业额还快','最近赚的差价 '+M(ctx.curr.profit,true)+'，比上一段的 '+M(ctx.prev.profit,true)+' 少了 '+pctAbs(ctx.chgProfit)+'；同期进账变化 '+P(ctx.chgNet)+'。',
        '进账没怎么掉、差价却掉得快，通常是便宜货卖得多了，或者进货涨价了，不是客人变少。把两段时间的「各类东西赚的差价」拉出来比一下，就能找到是哪一类。','all','boxTrend','赚的差价');
    }
  }

  if(ctx.waveDays.length){
    const w=ctx.waveDays.slice(0,3).map(d=>d.date+'（比平均'+(d.diff>=0?'高 ':'低 ')+pctAbs(d.diff)+'）').join('、');
    add('mid','有几天进账特别高或特别低','平均每天进账 '+M(ctx.mean,true)+'；特别的日子：'+w+'。最高的一天 '+(ctx.peakDay?ctx.peakDay.date+' '+M(ctx.peakDay.net,true):'—')+'，最低的一天 '+(ctx.lowDay?ctx.lowDay.date+' '+M(ctx.lowDay.net,true):'—')+'。',
      '给这几天各写一句备注：搞活动、下雨、停电、系统升级、来了个大客户团购……以后看走势时把这种偶发日子先放一边，才不会被一天带偏。','all','boxTrend','忽高忽低');
  }

  if(ctx.bigOrders.length){
    add('mid','有几笔金额特别大的单子','单笔超过 '+M(ctx.bigThreshold)+' 的一共 '+ctx.bigOrders.length+' 笔，最大的一笔 '+M(ctx.bigOrders[0].amount)+'（'+ctx.bigOrders[0].date+' '+ctx.bigOrders[0].time+' · '+ctx.bigOrders[0].store+'）。',
      '先确认是不是团购、挂账、押金，或者金额多敲了一个零。建议以后碰到特别大的单子先单独列出来人工看一眼，别让它把「平均每位客人花多少」拉高。','all','boxAnomaly','大单');
  }

  if(ctx.tailDown>=R.tailDays){
    add('high','最后连着几天都不太好','最近 '+ctx.tailDown+' 天，每天都低于这段时间的平均水平 '+M(ctx.mean,true)+'，已经连成一段了，不像偶然一天。',
      '先看这几天的客人和库存，再跟前几个同样的星期几比一比。确实是下滑的话，先把最卖钱的那几类货备齐、摆好，比直接打折更管用。','all','boxTrend','生意走势');
  }

  if(ctx.weekendAvg>0 && ctx.weekdayAvg>0){
    const diff=(ctx.weekendAvg-ctx.weekdayAvg)/ctx.weekdayAvg;
    if(Math.abs(diff)>R.weekDiff){
      add('mid','周末和工作日差别挺大','周末平均每天 '+M(ctx.weekendAvg,true)+'，工作日 '+M(ctx.weekdayAvg,true)+'，差了 '+pctAbs(diff)+'。',
        diff>0
          ? '把促销和拉新放在周四、周五先预热，周末把好卖的货备足、多开一个收银台；工作日就主推老顾客和会员。'
          : '工作日反而更好，说明客人多是附近上班的或来买必需品的。周末可以少排点班，把精力放在工作日的回头客上。','all','boxWeek','周几');
    }
  }

  const hourTotal=LL.sum(ctx.hourly);
  if(hourTotal>0){
    const hm=ctx.hourly.map((v,h)=>({h:h,v:v})).sort((a,b)=>b.v-a.v);
    const top3=hm.slice(0,3).reduce((s,x)=>s+x.v,0)/hourTotal;
    const quiet=hm.slice(-4).reduce((s,x)=>s+x.v,0)/hourTotal;
    const peakRange=hm.slice(0,3).map(x=>LL.pad(x.h)+':00').sort().join(' / ');
    add('mid','人手可以排得更合适','最忙的 3 个小时（'+peakRange+'）合起来占了 '+P(top3)+'；最闲的 4 个小时加起来才 '+P(quiet)+'。',
      '补货、理货、对账、培训都挪到闲的时候；忙之前半小时把货备好、台开好，忙的时候只留收银和招呼客人的人。','all','boxHour','排班');
  }

  if(ctx.topPayShare>R.payShare && ctx.payArr.length>1){
    add('low','钱几乎都从一个渠道进来','「'+ctx.payArr[0].label+'」占了 '+P(ctx.topPayShare)+'，第二名「'+(ctx.payArr[1]?ctx.payArr[1].label:'—')+'」占 '+(ctx.payArr[1]?P(ctx.payArr[1].value/LL.sum(ctx.payArr,x=>x.value)):'—')+'。',
      '都从一个渠道收钱本身没问题，但要保证每天都能拿到这个渠道的对账单，单独核对「已经收了、还没到账」的差额；另外至少留一条备用收款方式，免得它一出问题就收不了钱。','all','boxPay','收钱方式');
  }

  const medical=ctx.payArr.find(p=>/医保|社保|统筹/.test(p.label));
  if(medical){
    const share=medical.value/LL.sum(ctx.payArr,x=>x.value);
    add('mid','医保那部分钱要单独对','医保结算 '+M(medical.value,true)+'，占收进来的 '+P(share)+'。',
      '医保的钱通常要过一阵才真到账，按「哪天卖的」看收入，会跟「哪天到账」对不上。建议单独记一本医保台账，按结算批次一笔笔核；算手里有多少现金时，把这段延迟算进去。','all','boxPay','医保');
  }
  const room=ctx.catArr.find(c=>/房费|客房|住宿/.test(c.label));
  if(room){
    const share=room.value/LL.sum(ctx.catArr,x=>x.value);
    add('mid','除了房费，别的收入还能再做点','房费占了 '+P(share)+'，餐饮、会议、会员卡这些加起来才 '+P(1-share)+'。',
      '早餐、会议室这类不太需要额外成本，多卖一点很划算。试试「房 + 早餐」「房 + 会议室」的套餐，办入住时主动问一句，先让这部分占比涨个 3~5 个点。','all','boxCat','房费以外');
  }
  const fresh=ctx.catArr.find(c=>/生鲜|果蔬|肉禽/.test(c.label));
  if(fresh){
    const share=fresh.value/LL.sum(ctx.catArr,x=>x.value);
    add('low','生鲜是用来招客人的，别只看它赚多少','「'+fresh.label+'」卖了 '+M(fresh.value,true)+'，占 '+P(share)+'。',
      '生鲜本身差价薄，但客人常会顺手买别的。看看买生鲜的单子里平均还带了几样东西、有多少人顺手买了更赚钱的商品，再据此定晚上几点开始打折。','all','boxCat','生鲜');
  }
  if(ctx.catConcentration>R.catConcentration && !(ctx.catArr.length===1 && /未分类/.test(ctx.catArr[0].label))){
    add('mid','太靠某一类东西在撑营业额','卖得最多的「'+ctx.catArr[0].label+'」一家就占了 '+P(ctx.catConcentration)+'，剩下 '+Math.max(0,ctx.catArr.length-1)+' 类加起来才 '+P(1-ctx.catConcentration)+'。',
      '万一这类货断供、或者价格一波动，总营业额马上跟着抖。给排第 2 到第 4 的类各定一个「最少摆多少、最少备多少」的底线，再准备一份能替上的商品清单。','all','boxCat','卖的东西');
  }

  if(ctx.lateRatio>R.lateRatio && !hasRoom){
    add('mid','半夜的交易有点多，值得核一下','晚上 10 点到早上 6 点占了 '+P(ctx.lateRatio)+'，超市、药店一般这个时段不到 5%。',
      '先看是不是「日结时间设错了」或者「跨天的单子记到了前一天」。如果确实是夜里营业，再单独算算夜班的人工和安保钱值不值。','all','boxHour','排班');
  }

  if(!S.some(x=>x.level==='good') && !S.some(x=>x.level==='high') && ctx.cv<R.cvStable){
    add('good','这段时间挺平稳，没发现要紧问题','每天进账比较稳（起伏 '+LL.round(ctx.cv,2)+'），退款率 '+P(ctx.refundRate)+'，都在正常范围。',
      '保持现在每天导出、每天对账的习惯就行。可以把这页导成周报，固定盯住「每位客人花多少」和「退款率」这两个数。','all','boxTrend','总体不错');
  }

  const order={high:0,mid:1,low:2,good:3};
  S.sort((a,b)=>order[a.level]-order[b.level]);
  const out=S.slice(0,10);
  if(out.length && !out.some(x=>x.level==='good')){
    const good=S.find(x=>x.level==='good');
    if(good) out[out.length-1]=good;
  }
  return out;
};
LL.LEVEL_TEXT={high:'建议先处理',mid:'可以看看',low:'留意一下',good:'做得不错'};


/* ===== core/samples.js ===== */

/* ---------- 示例导出文件（不同表头） ---------- */
LL.buildSampleCSV = function(kind,biz){
  const rnd=LL.mulberry32(kind==='pos'?11:(kind==='wechat'?22:33));
  const demo=LL.generateDemoData('2026-11-08',30).filter(r=>r.amount>0&&r.direction==='收入');
  const pick=biz?demo.filter(r=>r.biz===biz):demo;
  // 等距抽样，保证导出的流水覆盖整个日期区间，趋势图才有参考价值
  const target=300, step=Math.max(1,Math.floor(pick.length/target)), rows=[];
  for(let i=0;i<pick.length && rows.length<target;i+=step) rows.push(pick[i]);
  const q=s=>{ const t=String(s==null?'':s); return /[",\t\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t; };
  let head=[],line;
  if(kind==='pos'){
    head=['交易日期','单据编号','实收金额','成本金额','结算方式','商品分类','商品名称','数量','门店名称','会员卡号','交易类型'];
    line=r=>[r.date,r.orderNo,r.amount.toFixed(2),r.cost!=null?r.cost.toFixed(2):'',r.payMethod,r.category,r.item,r.qty,r.store,r.member,'收款'].map(q).join(',');
  }else if(kind==='wechat'){
    head=['交易时间','微信订单号','应结订单金额','付款方式','商品名称','商户名称','商户号','交易状态'];
    line=r=>[r.date+' '+r.time+':00',r.orderNo,r.amount.toFixed(2),r.payMethod==='现金'?'零钱':r.payMethod,r.item,r.store,'1900'+String(1000+Math.floor(rnd()*8999)),'SUCCESS'].map(q).join(',');
  }else{
    head=['发生时间','支付宝交易号','发生金额','付款渠道','商品名称','门店','业务类型','备注'];
    line=r=>[r.date+' '+r.time,r.orderNo,r.amount.toFixed(2),r.payMethod,r.item,r.store,'交易付款','账目明细'].map(q).join(',');
  }
  return [head.map(q).join(',')].concat(rows.map(line)).join('\n');
};

/* ---------- 标准示例 CSV（给用户对照） ---------- */
LL.standardSampleCSV = function(){
  const rows=LL.generateDemoData('2026-11-08',3).filter(r=>r.amount>0).slice(0,40);
  const head=['交易日期','交易时间','单据编号','实收金额','成本金额','交易类型','结算方式','商品分类','商品名称','数量','门店名称','业态'];
  const q=s=>{ const t=String(s==null?'':s); return /[",\t\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t; };
  return [head.join(',')].concat(rows.map(r=>[r.date,r.time,r.orderNo,r.amount.toFixed(2),r.cost!=null?r.cost.toFixed(2):'',r.direction,r.payMethod,r.category,r.item,r.qty,r.store,LL.BIZ[r.biz]?LL.BIZ[r.biz].name:r.biz].map(q).join(','))).join('\n');
};

/* ===== ui/app.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* LL 由 core/ll.js 定义；构建时 CORE 与 UI 拼进同一作用域，此处直接复用。
   CORE 同时挂了 globalThis.LL，便于浏览器控制台与二次开发访问。 */
const $=s=>document.querySelector(s);
const $$=s=>Array.prototype.slice.call(document.querySelectorAll(s));
const PALETTE=['#2563eb','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ef4444','#14b8a6','#f472b6','#64748b','#84cc16'];
const LS={rec:'ledgerlens_records_v1',tpl:'ledgerlens_templates_v1',meta:'ledgerlens_meta_v1',
  guide:'ledgerlens_guide_seen_v2',cur:'ledgerlens_currency_v1',
  sug:'ledgerlens_sugstate_v1',rules:'ledgerlens_rules_v1',author:'ledgerlens_author_v1'};

const state={
  records:[], ctx:null, suggestions:[], sourceName:'', sourceType:'',
  filters:{from:'',to:'',biz:'all',store:'',pay:'',category:'',weekday:'',hour:''},
  trendMode:'net', catMode:'net', page:1, pageSize:20,
  detailQuery:'', sugView:'todo', dateRange:null,
  pending:null, pendingMeta:null, xlsxBuf:null, guideStep:0
};


/* ===== ui/store.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 存储 ---------- */
function lsGet(k,def){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch(e){ return def; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ toast('本机空间不够，这次的账没能存住；建议先导出表格留个底'); return false; } }
function headerSignature(headers){ return headers.map(LL.normalizeHeader).join('|'); }
/* 判定标准与制表人：本机保存，换设备需重设 */
function loadRulesFromStore(){
  const saved=lsGet(LS.rules,null);
  if(saved && typeof saved==='object'){
    LL.RULE_DEFS.forEach(d=>{
      const v=Number(saved[d.key]);
      if(isFinite(v)) LL.RULES[d.key]=Math.max(d.min/(d.scale||1),Math.min(d.max/(d.scale||1),v));
    });
  }
}
loadRulesFromStore();

/* 紧凑持久化：用「数组行」代替「每行重复 14 个 key 的对象」，
   同样容量能多存约 2~3 倍，且兼容旧版存过的对象数组 */
const PACK_FIELDS=['date','time','orderNo','amount','cost','direction','payMethod','category','item','qty','store','biz','member','src'];
function packRecords(recs){ return recs.map(r=>PACK_FIELDS.map(k=>r[k]===undefined?null:r[k])); }
function unpackRecords(arr){ return arr.map(a=>{ const o={}; PACK_FIELDS.forEach((k,i)=>o[k]=a[i]); return o; }); }
/* 导入指纹：同一笔流水在两份导出里重复出现时据此跳过 */
function recordFingerprint(r){
  // 不含 cost：同一笔流水在「带成本」与「不带成本」的两份导出里应视为同一笔，
  // 否则日结表 + 财务表叠加时营收会翻倍
  return [r.date,r.time,r.orderNo,r.amount,r.direction,r.payMethod,r.category,r.item,r.store].join('\u0001');
}


/* ===== ui/common.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 通用 UI ---------- */
let toastTimer=null;
function toast(msg){
  const t=$('#tooltip');
  t.innerHTML='<b>提示</b>　'+LL.esc(msg); t.style.display='block';
  t.style.left='50%'; t.style.top='76px'; t.style.transform='translateX(-50%)';
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>{t.style.display='none';t.style.transform='';},2600);
}
function showModal(id){ clearTimeout(toastTimer); const t=$('#tooltip'); if(t){ t.style.display='none'; t.style.transform=''; } $('#'+id).classList.add('show'); }
function hideModal(id){ $('#'+id).classList.remove('show'); }
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>hideModal(b.getAttribute('data-close'))));
$$('.mask').forEach(m=>m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('show'); }));
function downloadBinary(name,bytes,mime){
  const blob=new Blob([bytes],{type:mime||'application/octet-stream'});
  const a=document.createElement('a'), url=URL.createObjectURL(blob);
  a.href=url; a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},200);
}
function download(name,content,mime){
  const isHtml=/html/i.test(mime||'');
  const blob=new Blob([(isHtml?'':'\uFEFF')+content],{type:(mime||'text/plain')+';charset=utf-8'});
  const a=document.createElement('a'), url=URL.createObjectURL(blob);
  a.href=url; a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},200);
}
function trendHtml(v,goodWhenUp){
  if(!isFinite(v)||v===0) return '<span class="trend-flat">— 持平</span>';
  const up=v>0, good=goodWhenUp?up:!up;
  return '<span class="'+(good?'trend-up':'trend-down')+'">'+(up?'▲':'▼')+' '+LL.pct(Math.abs(v))+'</span>';
}


/* ===== ui/canvas.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- Canvas 图表基础 ---------- */
function setup(cv){
  const rect=cv.getBoundingClientRect();
  const dpr=window.devicePixelRatio||1;
  const w=Math.max(200,Math.floor(rect.width)), h=Math.max(120,Math.floor(rect.height));
  cv.width=w*dpr; cv.height=h*dpr;
  const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,w,h);
  g.font='11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  return {g:g,w:w,h:h};
}
function niceMax(v){
  if(v<=0) return 10;
  const e=Math.pow(10,Math.floor(Math.log10(v)));
  const n=v/e;
  const step=n<=1?1:n<=1.2?1.2:n<=1.5?1.5:n<=2?2:n<=2.5?2.5:n<=3?3:n<=5?5:10;
  return step*e;
}
function fmtAxis(v,compact){
  if(compact===false) return String(Math.round(v));
  if(Math.abs(v)>=10000) return LL.round(v/10000,1)+'万';
  if(Math.abs(v)>=1000) return LL.round(v/1000,1)+'k';
  return String(Math.round(v));
}
function grid(g,W,H,pad,max,min,ticks){
  g.strokeStyle='#eef2f8'; g.lineWidth=1; g.fillStyle='#8fa0bd'; g.textAlign='right'; g.textBaseline='middle';
  for(let i=0;i<=ticks;i++){
    const y=pad.t+(H-pad.t-pad.b)*i/ticks;
    g.beginPath(); g.moveTo(pad.l,y+.5); g.lineTo(W-pad.r,y+.5); g.stroke();
    const v=max-(max-min)*i/ticks;
    g.fillText(fmtAxis(v),pad.l-7,y);
  }
}
function tooltipAt(e,html){
  const t=$('#tooltip');
  t.innerHTML=html; t.style.display='block'; t.style.transform='';
  let x=e.clientX+14, y=e.clientY-10;
  if(x+240>window.innerWidth) x=e.clientX-240;
  if(y<10) y=10;
  t.style.left=x+'px'; t.style.top=y+'px';
}
function hideTip(){ $('#tooltip').style.display='none'; }

function drawLine(cv,labels,values,opt){
  opt=opt||{};
  const {g,w:W,h:H}=setup(cv);
  const pad={l:52,r:14,t:14,b:26};
  const max=niceMax(Math.max.apply(null,values.concat([0]))*1.08)||10;
  const min=Math.min(0,Math.min.apply(null,values));
  const minV=min<0?min*1.1:0;
  const cw=W-pad.l-pad.r, ch=H-pad.t-pad.b;
  const X=i=>pad.l+(labels.length<=1?cw/2:cw*i/(labels.length-1));
  const Y=v=>pad.t+ch*(max-v)/(max-minV||1);
  const color=opt.color||PALETTE[0];
  const fmt=opt.fmt||fmtAxis;

  function paint(hi){
    g.clearRect(0,0,W,H);
    g.font='11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    grid(g,W,H,pad,max,minV,4);
    const grad=g.createLinearGradient(0,pad.t,0,pad.t+ch);
    grad.addColorStop(0,color+'38'); grad.addColorStop(1,color+'02');
    g.beginPath(); g.moveTo(X(0),Y(Math.max(minV,0)));
    values.forEach((v,i)=>g.lineTo(X(i),Y(v)));
    g.lineTo(X(values.length-1),Y(Math.max(minV,0))); g.closePath();
    g.fillStyle=grad; g.fill();
    const avgLabel=(opt.avgLine!==undefined && opt.avgLine>=minV && opt.avgLine<=max)?('均值 '+fmtAxis(opt.avgLine)):null;
    if(avgLabel){
      g.save(); g.setLineDash([5,4]); g.strokeStyle='#f59e0b'; g.lineWidth=1.2;
      g.beginPath(); g.moveTo(pad.l,Y(opt.avgLine)); g.lineTo(W-pad.r,Y(opt.avgLine)); g.stroke(); g.restore();
    }
    g.beginPath(); values.forEach((v,i)=> i?g.lineTo(X(i),Y(v)):g.moveTo(X(i),Y(v)));
    g.strokeStyle=color; g.lineWidth=2.2; g.lineJoin='round'; g.stroke();
    g.fillStyle='#8fa0bd'; g.textAlign='center'; g.textBaseline='top';
    const step=Math.max(1,Math.ceil(labels.length/8));
    labels.forEach((l,i)=>{ if(i%step===0||i===labels.length-1) g.fillText(String(l).slice(5),X(i),H-pad.b+7); });
    // 均值标注放在左上角空白处，置于折线之上
    if(avgLabel){
      const tw=g.measureText(avgLabel).width;
      g.fillStyle='rgba(255,255,255,.92)'; g.fillRect(pad.l+5,pad.t+3,tw+10,17);
      g.fillStyle='#b26a00'; g.textAlign='left'; g.textBaseline='middle';
      g.fillText(avgLabel,pad.l+9,pad.t+12);
    }
    if(hi!==undefined && hi>=0 && hi<values.length){
      g.save();
      g.strokeStyle='#c9d6ea'; g.setLineDash([3,3]); g.lineWidth=1;
      g.beginPath(); g.moveTo(X(hi),pad.t); g.lineTo(X(hi),H-pad.b); g.stroke();
      g.setLineDash([]);
      g.beginPath(); g.arc(X(hi),Y(values[hi]),4.2,0,Math.PI*2);
      g.fillStyle='#fff'; g.fill(); g.lineWidth=2; g.strokeStyle=color; g.stroke();
      g.restore();
    }
  }
  paint();
  cv.onmousemove=function(e){
    const r=cv.getBoundingClientRect(), mx=e.clientX-r.left;
    let idx=Math.round((mx-pad.l)/(cw||1)*(labels.length-1));
    idx=Math.max(0,Math.min(labels.length-1,idx));
    paint(idx);
    tooltipAt(e,'<b>'+LL.esc(labels[idx])+'</b><br>'+LL.esc(opt.name||'数值')+'：'+fmt(values[idx]));
  };
  cv.onmouseleave=function(){ hideTip(); paint(); };
  cv._pick=function(e){
    const r=cv.getBoundingClientRect(), mx=e.clientX-r.left;
    let i=Math.round((mx-pad.l)/(cw||1)*(labels.length-1));
    i=Math.max(0,Math.min(labels.length-1,i));
    return {label:labels[i],value:values[i],index:i};
  };
}

function drawBar(cv,labels,values,opt){
  opt=opt||{};
  const {g,w:W,h:H}=setup(cv);
  const horizontal=!!opt.horizontal;
  const colors=opt.colors||values.map((_,i)=>PALETTE[i%PALETTE.length]);
  if(horizontal){
    const pad={l:Math.min(96,Math.max(60,W*0.26)),r:56,t:8,b:8};
    const max=niceMax(Math.max.apply(null,values.map(v=>Math.abs(v)).concat([0]))*1.05)||10;
    const ch=H-pad.t-pad.b, cw=W-pad.l-pad.r;
    const bh=Math.min(22,ch/values.length*0.68), gap=ch/values.length;
    g.strokeStyle='#eef2f8'; g.textAlign='right'; g.textBaseline='middle';
    for(let i=0;i<=4;i++){ const x=pad.l+cw*i/4; g.beginPath(); g.moveTo(x+.5,pad.t); g.lineTo(x+.5,H-pad.b); g.stroke(); }
    values.forEach((v,i)=>{
      const y=pad.t+gap*i+(gap-bh)/2, bw=Math.max(1,cw*Math.abs(v)/max);
      g.fillStyle=colors[i%colors.length];
      g.beginPath(); g.roundRect?g.roundRect(pad.l,y,bw,bh,[0,4,4,0]):g.rect(pad.l,y,bw,bh); g.fill();
      g.fillStyle='#33445f'; g.textAlign='right'; g.fillText(String(labels[i]).slice(0,8),pad.l-7,y+bh/2);
      g.fillStyle='#7285a3'; g.textAlign='left'; g.fillText(opt.fmt?opt.fmt(v):fmtAxis(v),pad.l+bw+6,y+bh/2);
    });
    cv.onmousemove=function(e){
      const r=cv.getBoundingClientRect(), my=e.clientY-r.top;
      const i=Math.floor((my-pad.t)/gap);
      if(i<0||i>=values.length) return;
      tooltipAt(e,'<b>'+LL.esc(labels[i])+'</b><br>'+LL.esc(opt.name||'数值')+'：'+(opt.fmt?opt.fmt(values[i]):fmtAxis(values[i])));
    };
    cv.onmouseleave=hideTip;
    cv._pick=function(e){
      const r=cv.getBoundingClientRect(), my=e.clientY-r.top;
      const i=Math.floor((my-pad.t)/gap);
      if(i<0||i>=values.length) return null;
      return {label:labels[i],value:values[i],index:i};
    };
  }else{
    const pad={l:48,r:12,t:14,b:28};
    const max=niceMax(Math.max.apply(null,values.map(v=>Math.abs(v)).concat([0]))*1.08)||10;
    const min=0, cw=W-pad.l-pad.r, ch=H-pad.t-pad.b;
    grid(g,W,H,pad,max,min,4);
    const bw=Math.min(34,cw/values.length*0.66), step=cw/values.length;
    values.forEach((v,i)=>{
      const x=pad.l+step*i+(step-bw)/2, bh=Math.max(1,ch*Math.abs(v)/max), y=pad.t+ch-bh;
      g.fillStyle=colors[i%colors.length];
      g.beginPath(); g.roundRect?g.roundRect(x,y,bw,bh,[4,4,0,0]):g.rect(x,y,bw,bh); g.fill();
    });
    g.fillStyle='#8fa0bd'; g.textAlign='center'; g.textBaseline='top';
    const st=Math.max(1,Math.ceil(labels.length/12));
    labels.forEach((l,i)=>{ if(i%st===0||i===labels.length-1) g.fillText(String(l),pad.l+step*i+step/2,H-pad.b+7); });
    cv.onmousemove=function(e){
      const r=cv.getBoundingClientRect(), mx=e.clientX-r.left;
      const i=Math.floor((mx-pad.l)/step);
      if(i<0||i>=values.length) return;
      tooltipAt(e,'<b>'+LL.esc(labels[i])+'</b><br>'+LL.esc(opt.name||'数值')+'：'+(opt.fmt?opt.fmt(values[i]):fmtAxis(values[i])));
    };
    cv.onmouseleave=hideTip;
    cv._pick=function(e){
      const r=cv.getBoundingClientRect(), mx=e.clientX-r.left;
      const i=Math.floor((mx-pad.l)/step);
      if(i<0||i>=values.length) return null;
      return {label:labels[i],value:values[i],index:i};
    };
  }
}

function drawDonut(cv,items,opt){
  opt=opt||{};
  const {g,w:W,h:H}=setup(cv);
  const cx=W/2, cy=H/2, R=Math.min(W,H)/2-16, r=R*0.62;
  const total=LL.sum(items,x=>Math.max(0,x.value));
  let a=-Math.PI/2;
  if(total<=0){ g.fillStyle='#8fa0bd'; g.textAlign='center'; g.fillText('暂无数据',cx,cy); return; }
  items.forEach((it,i)=>{
    const ang=Math.PI*2*Math.max(0,it.value)/total;
    g.beginPath(); g.arc(cx,cy,R,a,a+ang); g.arc(cx,cy,r,a+ang,a,true); g.closePath();
    g.fillStyle=it.color||PALETTE[i%PALETTE.length]; g.fill();
    g.strokeStyle='#fff'; g.lineWidth=2; g.stroke();
    a+=ang;
  });
  g.fillStyle='#16233a'; g.textAlign='center'; g.textBaseline='middle';
  g.font='bold 17px -apple-system,"PingFang SC",sans-serif';
  g.fillText(opt.center||fmtAxis(total),cx,cy-8);
  g.font='11px -apple-system,"PingFang SC",sans-serif'; g.fillStyle='#7285a3';
  g.fillText(opt.centerSub||'合计',cx,cy+13);
  cv.onmousemove=function(e){
    const rect=cv.getBoundingClientRect(), mx=e.clientX-rect.left-cx, my=e.clientY-rect.top-cy;
    const dist=Math.sqrt(mx*mx+my*my);
    if(dist<r||dist>R){ hideTip(); return; }
    let ang=Math.atan2(my,mx)+Math.PI/2; if(ang<0) ang+=Math.PI*2;
    let acc=0, hit=null, idx=0;
    for(let i=0;i<items.length;i++){ const s=Math.PI*2*Math.max(0,items[i].value)/total; if(ang>=acc&&ang<acc+s){hit=items[i];idx=i;break;} acc+=s; }
    if(!hit) return;
    tooltipAt(e,'<b>'+LL.esc(hit.label)+'</b><br>'+LL.money(hit.value)+'　'+LL.pct(hit.value/total));
  };
  cv._pick=function(e){
    const rect=cv.getBoundingClientRect(), mx=e.clientX-rect.left-cx, my=e.clientY-rect.top-cy;
    const dist=Math.sqrt(mx*mx+my*my);
    if(dist<r||dist>R) return null;
    let ang=Math.atan2(my,mx)+Math.PI/2; if(ang<0) ang+=Math.PI*2;
    let acc=0;
    for(let i=0;i<items.length;i++){
      const seg=Math.PI*2*Math.max(0,items[i].value)/total;
      if(ang>=acc&&ang<acc+seg) return {label:items[i].label,value:items[i].value,index:i};
      acc+=seg;
    }
    return null;
  };
  cv.onmouseleave=hideTip;
}


/* ===== ui/render-kpi.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 渲染：KPI ---------- */
function renderKPI(ctx){
  const has=ctx.hasCost;
  const help='<span class="k-help" data-glossary="1" title="点一下看这些词是什么意思">?</span>';
  const CV=LL.RULES.cvStable;
  const cvWord=ctx.cv<CV*0.7?'很稳':(ctx.cv<CV*1.4?'还算稳':'忽高忽低');
  const k=[
    {c:'', l:'实际进账',v:LL.money(ctx.net,true),s:'扣掉退款和支出后真正留下的钱',t:trendHtml(ctx.chgNet,true)},
    {c:'c5',l:'赚的差价',v:has?LL.money(ctx.grossProfit,true):'—',s:has?'卖价减进价，还没扣房租人工':'表里没写进价，算不出来',t:has?trendHtml(ctx.chgProfit,true):'<span class="trend-flat">缺进价</span>'},
    {c:'c7',l:'差价占比',v:(has&&ctx.grossMargin!==null)?LL.pct(ctx.grossMargin,1):'—',s:has?('每收 100 元里有几元是差价 · '+LL.pct(ctx.costCoverage)+' 的账有进价'):'把进价列指对就能算',t:'<span class="trend-flat">'+(has?'还没扣房租人工':'—')+'</span>'},
    {c:'c2',l:'一共多少单',v:ctx.orders.toLocaleString('zh-CN'),s:'同一个单号只算一次 · 共 '+ctx.dayCount+' 天',t:trendHtml(ctx.chgOrders,true)},
    {c:'c3',l:'客人平均花多少',v:LL.money(ctx.avgTicket),s:'实际进账 ÷ 单数',t:trendHtml(ctx.chgTicket,true)},
    {c:'c4',l:'退回去多少',v:LL.pct(ctx.refundRate,2),s:'一般不超过 '+LL.pct(ctx.refundLimit)+' · 共退 '+LL.money(ctx.refund,true),t:'<span class="trend-flat">'+(ctx.refundRate>ctx.refundLimit?'有点多':'正常')+'</span>'},
    {c:'c6',l:'平均每天进账',v:LL.money(ctx.dailyAvg,true),s:'最高的一天 '+(ctx.peakDay?LL.money(ctx.peakDay.net,true):'—'),t:'<span class="trend-flat">'+ctx.dayCount+' 天</span>'},
    {c:'c8',l:'每天稳不稳',v:cvWord,s:'每天进账起伏 '+LL.round(ctx.cv,2)+' · 越小越稳',t:'<span class="trend-flat">'+ctx.dayCount+' 天</span>'}
  ];
  $('#kpiRow').innerHTML=k.map(x=>'<div class="kpi '+x.c+'"><div class="k-label">'+x.l+help+'</div><div class="k-val">'+x.v+'</div><div class="k-sub">'+x.t+' <span>'+LL.esc(x.s)+'</span></div></div>').join('');
  $$('#kpiRow .k-help').forEach(el=>el.addEventListener('click',()=>showModal('glossaryModal')));
}


/* ===== ui/render-charts.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 渲染：图表 ---------- */
function drawEmpty(cv,msg){
  const {g,w:W,h:H}=setup(cv);
  g.fillStyle='#8fa0bd'; g.textAlign='center'; g.textBaseline='middle';
  g.font='13px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  g.fillText(msg,W/2,H/2-8);
  g.font='11px -apple-system,"PingFang SC",sans-serif';
  g.fillText('放文件时把「进价 / 成本 / 毛利」那一列指对，就能看到了',W/2,H/2+16);
  cv.onmousemove=null; cv.onmouseleave=null; cv._pick=null;
}
function renderCharts(ctx){
  const moneyFmt=v=>LL.money(v,true);
  // 趋势：净营收 / 订单数 / 毛利额
  const tMode=state.trendMode;
  const vals=tMode==='net'?ctx.daily.map(d=>d.net):(tMode==='orders'?ctx.daily.map(d=>d.orders):ctx.daily.map(d=>d.profit));
  if(tMode==='profit'&&!ctx.hasCost){ drawEmpty($('#chartTrend'),'这份表没写进价，画不出赚的差价'); }
  else drawLine($('#chartTrend'),ctx.daily.map(d=>d.date),vals,{
    color:tMode==='net'?PALETTE[0]:(tMode==='orders'?PALETTE[2]:'#14b8a6'),
    name:tMode==='net'?'净营收':(tMode==='orders'?'订单数':'毛利额'),
    fmt:tMode==='net'?moneyFmt:(tMode==='orders'?(v=>v.toLocaleString('zh-CN')+' 单'):moneyFmt),
    avgLine:tMode==='net'?ctx.mean:undefined
  });
  const cmp=ctx.compareMode.indexOf('数据不足')>=0 ? '数据太少，不做对比'
    : ('跟 '+ctx.compareMode.replace('最近 ','').replace(' 天 vs 前 ',' 天 / 前 ')+' 比');
  $('#trendSub').textContent=ctx.dayCount+' 天 · 虚线是平均水平 · '+cmp;

  // 支付
  const pays=ctx.payArr.slice(0,8).map((p,i)=>({label:p.label,value:p.value,color:PALETTE[i%PALETTE.length]}));
  if(ctx.payArr.length>8) pays.push({label:'其他',value:LL.sum(ctx.payArr.slice(8),x=>x.value),color:'#cbd5e1'});
  drawDonut($('#chartPay'),pays,{center:LL.money(LL.sum(pays,x=>x.value),true),centerSub:'实收合计'});
  const ptotal=LL.sum(pays,x=>x.value)||1;
  $('#payLegend').innerHTML=pays.map(p=>'<span><i style="background:'+p.color+'"></i>'+LL.esc(p.label)+' <b>'+LL.pct(p.value/ptotal)+'</b></span>').join('');
  $('#paySub').textContent=pays.length+' 种收钱方式 · 按实收金额';

  // 品类：净营收 / 毛利额 / 毛利率
  const cm=state.catMode;
  if(cm!=='net'&&!ctx.hasCost){ drawEmpty($('#chartCat'),'这份表没写进价，暂时只能看卖了多少'); }
  else if(cm==='net'){
    const cats=ctx.catArr.slice(0,8);
    drawBar($('#chartCat'),cats.map(c=>c.label),cats.map(c=>c.value),{horizontal:true,fmt:moneyFmt,name:'净营收',colors:cats.map((_,i)=>PALETTE[i%PALETTE.length])});
  }else if(cm==='profit'){
    const cats=ctx.catProfitArr.slice(0,8);
    drawBar($('#chartCat'),cats.map(c=>c.label),cats.map(c=>c.value),{horizontal:true,fmt:moneyFmt,name:'毛利额',
      colors:cats.map(c=>c.value<0?'#ef4444':'#10b981')});
  }else{
    const cats=ctx.catProfitArr.filter(c=>c.sales>0).sort((a,b)=>b.margin-a.margin).slice(0,8);
    drawBar($('#chartCat'),cats.map(c=>c.label),cats.map(c=>c.margin*100),{horizontal:true,
      fmt:v=>LL.round(v,1)+'%',name:'毛利率',colors:cats.map(c=>c.margin<0?'#ef4444':'#8b5cf6')});
  }

  // 品类毛利贡献（红色 = 毛利倒挂）
  if(!ctx.hasCost){
    drawEmpty($('#chartProfit'),'这份表没写进价，算不出各类东西赚多少');
    $('#profitSub').textContent='放文件时把进价列指对就能看';
  }else{
    const gp=ctx.catProfitArr.slice(0,8);
    drawBar($('#chartProfit'),gp.map(c=>c.label),gp.map(c=>c.value),{horizontal:true,fmt:moneyFmt,name:'毛利额',
      colors:gp.map(c=>c.value<0?'#ef4444':'#14b8a6')});
    const neg=ctx.catProfitArr.filter(c=>c.value<0).length;
    $('#profitSub').textContent='前 '+gp.length+' 类 · '+LL.pct(ctx.costCoverage)+' 的账有进价'+(neg?' · '+neg+' 类在亏钱':'');
  }

  // 时段
  drawBar($('#chartHour'),ctx.hourly.map((_,h)=>LL.pad(h)),ctx.hourly,{fmt:moneyFmt,name:'营收',colors:ctx.hourly.map((v,h)=>h>=22||h<6?'#f59e0b':PALETTE[0])});
  $('#hourSub').textContent='橙色是晚上 10 点–早上 6 点，占 '+LL.pct(ctx.lateRatio);

  // 星期
  drawBar($('#chartWeek'),LL.WEEK_NAMES,ctx.weekAvg,{fmt:moneyFmt,name:'日均净营收',colors:['#0ea5e9','#0ea5e9','#0ea5e9','#0ea5e9','#0ea5e9','#8b5cf6','#8b5cf6']});

  // 门店
  const stores=ctx.storeArr.slice(0,8);
  drawBar($('#chartStore'),stores.map(s=>s.label),stores.map(s=>s.value),{horizontal:true,fmt:moneyFmt,name:'净营收',colors:stores.map((_,i)=>PALETTE[(i+2)%PALETTE.length])});

  // 退款
  const refs=ctx.refundArr.slice(0,7);
  drawBar($('#chartRefund'),refs.map(r=>r.label),refs.map(r=>r.value),{horizontal:true,fmt:moneyFmt,name:'退款额',colors:refs.map(()=> '#ef4444')});
}


/* ===== ui/suggestions.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 建议闭环：标记已处理 / 先不看，记住当时的数字，回看有没有变 ---------- */
function sugKey(title){ return state.sourceName+'|'+title; }
function getSugStates(){ return lsGet(LS.sug,{}); }
function sugSnapshot(ctx){
  return {net:LL.round(ctx.net,2),ticket:LL.round(ctx.avgTicket,2),refund:LL.round(ctx.refundRate,4),
    margin:ctx.grossMargin===null?null:LL.round(ctx.grossMargin,4),orders:ctx.orders,
    daily:LL.round(ctx.dailyAvg,2)};
}
function sugSnapshotText(st,ctx){
  if(!st||!st.snap) return '';
  const a=st.snap, b=sugSnapshot(ctx);
  const pctChg=(x,y)=>x?LL.pct((y-x)/Math.abs(x),1):'—';
  return '<div class="sug-diff"><b>标记时 → 现在：</b>实际进账 '+LL.money(a.net,true)+' → '+LL.money(b.net,true)+
    '（'+pctChg(a.net,b.net)+'）　客人平均花 '+LL.money(a.ticket)+' → '+LL.money(b.ticket)+'</div>';
}
function setSugState(title,status){
  const all=getSugStates(), k=sugKey(title);
  if(status===null) delete all[k];
  else all[k]={status:status,at:new Date().toLocaleString('zh-CN'),snap:sugSnapshot(state.ctx)};
  lsSet(LS.sug,all);
  renderSuggestions(state.ctx); renderSummary(state.ctx);
  toast(status==='done'?'已记成「处理过了」，可在「已处理」里回看当时的数字':(status==='ignored'?'这条先收起来，可在「全部」里找回来':'已撤销，回到待办'));
}

/* ---------- 渲染：建议 ---------- */

function renderSuggestions(ctx){
  const all=LL.buildSuggestions(ctx,state.filters.biz);
  const states=getSugStates();
  all.forEach(s=>{ const st=states[sugKey(s.title)]; s._state=st?st.status:''; s._st=st||null; });
  state.allSuggestions=all;
  const view=state.sugView;
  const list=view==='todo'?all.filter(s=>!s._state):(view==='done'?all.filter(s=>s._state==='done'||s._state==='ignored'):all);
  state.suggestions=list;
  const doneN=all.filter(s=>s._state==='done').length, ignN=all.filter(s=>s._state==='ignored').length;
  $('#sugHint').innerHTML='待办 <b>'+all.filter(s=>!s._state).length+'</b> 条 · 已处理 '+doneN+' 条 · 先不看 '+ignN+' 条'+
    '<span class="sug-seg" id="segSug"><button data-v="todo" class="'+(view==='todo'?'on':'')+'">待办</button>'+
    '<button data-v="all" class="'+(view==='all'?'on':'')+'">全部</button>'+
    '<button data-v="done" class="'+(view==='done'?'on':'')+'">已处理 / 收起</button></span>';
  $$('#segSug button').forEach(b=>b.addEventListener('click',()=>{
    state.sugView=b.getAttribute('data-v'); renderSuggestions(state.ctx);
  }));
  if(!list.length){
    $('#suggestList').innerHTML='<div class="empty">'+(view==='todo'?'待办都清完了，真棒。点「全部」还能回看以前的建议':(view==='done'?'还没标记过任何一条':'这段时间没发现需要特别处理的事'))+'</div>';
    return;
  }
  $('#suggestList').innerHTML=list.map((s,i)=>{
    const st=s._state;
    const ops=st
      ? '<span class="sug-state '+(st==='done'?'done':'ign')+'">'+(st==='done'?'✓ 已处理':'⊘ 先不看')+'</span><button class="sug-op" data-sug="undo" data-title="'+LL.esc(s.title)+'">撤销</button>'
      : '<button class="sug-op primary" data-sug="done" data-title="'+LL.esc(s.title)+'">✓ 处理过了</button><button class="sug-op" data-sug="ignored" data-title="'+LL.esc(s.title)+'">⊘ 先不看</button>';
    return '<div class="sug '+s.level+(st?' sug-'+st:'')+'">'+
      '<div class="sug-top"><h4>'+LL.esc(s.title)+'</h4><span class="lv '+s.level+'">'+LL.LEVEL_TEXT[s.level]+'</span></div>'+
      '<div class="ev"><b>为什么这么说：</b>'+LL.esc(s.evidence)+'</div>'+
      '<div class="act"><em>可以这么做 →</em> '+LL.esc(s.advice)+'</div>'+
      (st?sugSnapshotText(s._st,ctx):'')+
      '<div class="foot"><span>#'+String(i+1).padStart(2,'0')+' · '+LL.esc(s.tag)+(st?' · '+LL.esc(s._st.at):'')+'</span>'+
        '<span style="display:flex;gap:6px;align-items:center">'+
        (s.focus?'<button class="btn ghost sm" data-focus="'+s.focus+'">去看看那张图 ↗</button>':'')+ops+'</span>'+
      '</div></div>';
  }).join('');
  $$('[data-focus]').forEach(b=>b.addEventListener('click',()=>{
    const el=document.getElementById(b.getAttribute('data-focus'));
    if(!el) return;
    el.scrollIntoView({behavior:'smooth',block:'center'});
    el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1600);
  }));
  $$('[data-sug]').forEach(b=>b.addEventListener('click',()=>{
    const a=b.getAttribute('data-sug'), t=b.getAttribute('data-title');
    setSugState(t,a==='undo'?null:a);
  }));
}


function renderAnomalies(ctx){
  const rows=[];
  ctx.waveDays.slice(0,6).forEach(d=>rows.push({type:'这天特别高/低',level:'中',when:d.date,desc:'当天进账 '+LL.money(d.net,true)+'，比平均'+(d.diff>=0?'高 ':'低 ')+LL.pct(Math.abs(d.diff)),val:d.net}));
  ctx.bigOrders.slice(0,6).forEach(r=>rows.push({type:'金额特别大的单',level:'中',when:r.date+' '+r.time,desc:r.orderNo+' · '+r.store+' · '+r.category,val:r.amount}));
  if(ctx.refundRate>ctx.refundLimit) rows.push({type:'退得有点多',level:'高',when:'整段时间',desc:'退回去 '+LL.pct(ctx.refundRate)+'，一般不超过 '+LL.pct(ctx.refundLimit)+'；共 '+LL.money(ctx.refund,true),val:-ctx.refund});
  if(ctx.tailDown>=LL.RULES.tailDays) rows.push({type:'连着几天偏淡',level:'高',when:'最近 '+ctx.tailDown+' 天',desc:'每天都低于平均水平 '+LL.money(ctx.mean,true),val:0});
  if(ctx.lateRatio>LL.RULES.lateRatio) rows.push({type:'半夜的单偏多',level:'中',when:'22:00–06:00',desc:'占了 '+LL.pct(ctx.lateRatio)+'，看看是不是日结时间设错了',val:0});
  if(!rows.length) rows.push({type:'—',level:'—',when:'—',desc:'没发现特别需要核对的账',val:0});
  $('#anomalyTable').innerHTML='<thead><tr><th>什么事</th><th>要不要紧</th><th>什么时候</th><th>具体情况</th><th style="text-align:right">涉及金额</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td><b>'+r.type+'</b></td><td>'+(r.level==='高'?'<span class="neg">高</span>':r.level)+'</td><td>'+LL.esc(r.when)+'</td><td>'+LL.esc(r.desc)+'</td><td class="num '+(r.val>0?'pos':r.val<0?'neg':'')+'">'+(r.val?LL.money(r.val):'—')+'</td></tr>').join('')+'</tbody>';
}


/* ===== ui/render-detail.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 渲染：明细表 ---------- */

function renderDetail(ctx){
  const q=String(state.detailQuery||'').trim().toLowerCase();
  const all=ctx.rows.slice().sort((a,b)=> (b.date+b.time).localeCompare(a.date+a.time));
  const rows=q?all.filter(r=>{
    const hay=[r.date,r.time,r.orderNo,r.direction,r.payMethod,r.category,r.item,r.store,
      (LL.BIZ[r.biz]?LL.BIZ[r.biz].name:r.biz),r.amount,r.cost,r.member].join(' ').toLowerCase();
    return hay.indexOf(q)>=0;
  }):all;
  const pages=Math.max(1,Math.ceil(rows.length/state.pageSize));
  state.page=Math.min(state.page,pages);
  const slice=rows.slice((state.page-1)*state.pageSize,state.page*state.pageSize);
  const rowProfit=r=>r.cost==null||r.direction==='支出'?null:(r.direction==='退款'?r.amount+r.cost:r.amount-r.cost);
  $('#detailTable').innerHTML='<thead><tr><th>日期</th><th>时间</th><th>单号</th><th>收 / 退</th><th>怎么付的</th><th>哪类东西</th><th>哪家店</th><th>哪门生意</th><th style="text-align:right">金额</th><th style="text-align:right">进价</th><th style="text-align:right">赚的差价</th></tr></thead><tbody>'+
    (slice.length?slice.map(r=>{const pr=rowProfit(r);return '<tr><td>'+r.date+'</td><td>'+r.time+'</td><td>'+LL.esc(r.orderNo)+'</td><td>'+r.direction+'</td><td>'+LL.esc(r.payMethod)+'</td><td>'+LL.esc(r.category)+'</td><td>'+LL.esc(r.store)+'</td><td>'+LL.esc(LL.BIZ[r.biz]?LL.BIZ[r.biz].name:(r.biz==='imported'?'导入':r.biz))+'</td><td class="num '+(r.amount>=0?'pos':'neg')+'">'+LL.money(r.amount)+'</td><td class="num">'+(r.cost==null?'—':LL.money(r.cost))+'</td><td class="num '+(pr==null?'':(pr>=0?'pos':'neg'))+'">'+(pr==null?'—':LL.money(pr))+'</td></tr>';}).join('')
      :'<tr><td colspan="11" class="empty">'+(q?'没找到含「'+LL.esc(state.detailQuery)+'」的账，换个词或点「清空」':'按现在选的条件，一笔账都没查到')+'</td></tr>')+'</tbody>';
  $('#pageInfo').textContent=(q?'找到 '+rows.length.toLocaleString('zh-CN')+' 笔（共 '+all.length.toLocaleString('zh-CN')+' 笔）':'共 '+rows.length.toLocaleString('zh-CN')+' 笔')+' · 第 '+state.page+' / '+pages+' 页';
  $('#detailHint').textContent='按时间倒序 · 每页 '+state.pageSize+' 笔 · 导出表格不受搜索影响';
}


function refreshFilterOptions(){
  const recs=state.records;
  const uniq=(f)=>{ const s=new Set(); recs.forEach(r=>{const v=f(r); if(v) s.add(v);}); return [...s].sort(); };
  const bizSel=$('#filterBiz');
  const bizKeys=uniq(r=>r.biz);
  bizSel.innerHTML='<option value="all">全部业态</option>'+bizKeys.map(k=>'<option value="'+LL.esc(k)+'">'+LL.esc(LL.BIZ[k]?LL.BIZ[k].name:(k==='imported'?'导入数据':k))+'</option>').join('');
  bizSel.value=state.filters.biz;
  const fill=(sel,arr,ph,cur)=>{ $(sel).innerHTML='<option value="">'+ph+'</option>'+arr.map(v=>'<option value="'+LL.esc(v)+'">'+LL.esc(v)+'</option>').join(''); $(sel).value=cur||''; };
  fill('#filterStore',uniq(r=>r.store),'全部门店',state.filters.store);
  fill('#filterPay',uniq(r=>r.payMethod),'全部支付方式',state.filters.pay);
  fill('#filterCat',uniq(r=>r.category),'全部品类',state.filters.category);
  const dates=recs.map(r=>r.date).sort();
  if(dates.length){
    if(!state.filters.from) state.filters.from=dates[0];
    if(!state.filters.to) state.filters.to=dates[dates.length-1];
    $('#filterFrom').value=state.filters.from; $('#filterTo').value=state.filters.to;
  }
  state.dateRange={min:dates[0]||'',max:dates[dates.length-1]||''};
  $('#filterInfo').innerHTML='一共 <b>'+recs.length.toLocaleString('zh-CN')+'</b> 笔账<br>日期：<b>'+state.filters.from+'</b> 到 <b>'+state.filters.to+'</b>';
}


/* ===== ui/render-summary.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 一句话结论：外行进来第一眼先看这里 ---------- */
function renderSummary(ctx){
  const isDemo=state.sourceType==='内置演示';
  const badge=$('#heroBadge');
  badge.textContent=isDemo?'示例账目（不是你的真实数据）':'你放进来的账目';
  badge.className='hero-badge'+(isDemo?'':' real');
  $('#heroPeriod').textContent=state.filters.from+' ~ '+state.filters.to+' · 共 '+ctx.rows.length.toLocaleString('zh-CN')+' 笔账';

  const RC=LL.RULES.netChange;
  const change=ctx.chgNet>RC?('比上一段好了 '+LL.pct(ctx.chgNet))
    :(ctx.chgNet<-RC?('比上一段淡了 '+LL.pct(Math.abs(ctx.chgNet))):'跟上一段差不多');
  $('#heroTitle').textContent='这段时间一共收进 '+LL.money(ctx.sales,true)+'，扣掉退款和支出后，实际留下 '+LL.money(ctx.net,true)+'。'+change+'。';
  $('#heroSub').textContent=ctx.hasCost
    ? ('有记进价的那部分账，卖价减进价共赚了 '+LL.money(ctx.grossProfit,true)+'，差价占这部分收入的 '+LL.pct(ctx.grossMargin)+'。注意：这还没扣房租、人工、水电，不是最后落到口袋的钱。')
    : ('这份表没写进价，所以暂时算不出赚了多少差价；收了多少钱、退了多少、客人平均花多少，这些照样能看。把进价列指对后就能补全。');

  $('#heroNums').innerHTML=[
    ['一共收进',LL.money(ctx.sales,true)],
    ['实际留下',LL.money(ctx.net,true)],
    ['一共做了',ctx.orders.toLocaleString('zh-CN')+' 单'],
    ['客人平均花',LL.money(ctx.avgTicket)]
  ].map(x=>'<div class="hero-num"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('');

  const todo=(state.allSuggestions||[]).filter(x=>!x._state);
  const first=todo.find(x=>x.level==='high')||todo.find(x=>x.level==='mid');
  $('#heroTodo').innerHTML='<span class="todo-ico">'+(first?'👉':'✅')+'</span><div>'+
    (first?'<b>最该先看的一件事：'+LL.esc(first.title)+'</b><br>'+LL.esc(first.advice.length>110?first.advice.slice(0,110)+'…（下面有完整做法）':first.advice)
          :'没发现要紧问题。可以按下面几张图看看生意走势，或者把这份结论导出来留底。')+
    '</div>';
}


/* ===== ui/drill.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 图表下钻：点柱子 / 扇区 / 折线，把条件写进筛选器 ---------- */
const DRILL_FIELD={chartTrend:'date',chartPay:'pay',chartCat:'category',chartProfit:'category',
  chartHour:'hour',chartWeek:'weekday',chartStore:'store',chartRefund:'category'};
function applyDrill(canvasId,hit){
  if(!hit) return;
  const field=DRILL_FIELD[canvasId];
  if(!field) return;
  if(hit.label==='其他'||hit.label==='未分类'){
    toast('「'+hit.label+'」是好几项合在一起的，没法单独只看这一类'); return;
  }
  let desc='';
  if(field==='date'){
    state.filters.from=state.filters.to=hit.label; desc='只看 '+hit.label+' 这一天';
  }else if(field==='hour'){
    state.filters.hour=String(hit.index).padStart(2,'0'); desc='只看 '+hit.label+':00 这一个小时';
  }else if(field==='weekday'){
    state.filters.weekday=String(hit.index); desc='只看'+hit.label;
  }else{
    state.filters[field]=hit.label; desc='只看「'+hit.label+'」';
  }
  state.page=1; renderAll();
  const box=$('#filterInfo'); if(box){ box.classList.add('flash'); setTimeout(()=>box.classList.remove('flash'),1600); }
  toast('已'+desc+'。不想看了就点左边「全部重置」，或点条件上的 ×');
}
function clearOneFilter(key){
  if(key==='from'||key==='to'||key==='date'){
    state.filters.from=''; state.filters.to='';
    refreshFilterOptions();
  }else if(key==='biz'){ state.filters.biz='all'; }
  else { state.filters[key]=''; }
  state.page=1; renderAll();
}
function syncFilterUI(){
  const f=state.filters;
  const put=(sel,v)=>{ const el=$(sel); if(el && el.value!==String(v==null?'':v)) el.value=String(v==null?'':v); };
  put('#filterFrom',f.from); put('#filterTo',f.to); put('#filterBiz',f.biz);
  put('#filterStore',f.store); put('#filterPay',f.pay); put('#filterCat',f.category);
}
function renderFilterChips(){
  const f=state.filters, chips=[];
  const add=(key,text)=>chips.push('<button class="chip" data-clear="'+key+'">'+LL.esc(text)+' <b>×</b></button>');
  if(f.store) add('store','门店：'+f.store);
  if(f.pay) add('pay','收款：'+f.pay);
  if(f.category) add('category','东西：'+f.category);
  if(f.biz&&f.biz!=='all') add('biz','生意：'+(LL.BIZ[f.biz]?LL.BIZ[f.biz].name:f.biz));
  if(f.weekday!==''&&f.weekday!=null) add('weekday','只看'+LL.WEEK_NAMES[Number(f.weekday)]);
  if(f.hour!==''&&f.hour!=null) add('hour','只看 '+String(f.hour).padStart(2,'0')+':00');
  if(f.from&&f.to&&f.from===f.to) add('date','只看 '+f.from+' 一天');
  const box=$('#filterChips');
  if(!box) return;
  box.innerHTML=chips.length?('<span class="chips-label">现在只看：</span>'+chips.join('')):'<span class="chips-none">没有额外条件，看的是全部账目</span>';
  $$('#filterChips .chip').forEach(b=>b.addEventListener('click',()=>clearOneFilter(b.getAttribute('data-clear'))));
}


/* ===== ui/render-all.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 主渲染 ---------- */
function renderAll(){
  if(!state.records.length){ $('#kpiRow').innerHTML='<div class="empty" style="grid-column:span 4">先在左边放一份账目进来</div>'; return; }
  const ctx=LL.computeAnalytics(state.records,state.filters);
  state.ctx=ctx;
  renderKPI(ctx); renderCharts(ctx); renderSuggestions(ctx); renderAnomalies(ctx); renderDetail(ctx); renderSummary(ctx); renderFilterChips(); syncFilterUI();
  $('#sourceInfo').innerHTML='<b>现在看的是：</b>'+LL.esc(state.sourceName)+'<br><span class="badge ok">'+(state.sourceType==='内置演示'?'示例':'你的文件')+'</span> 共 '+state.records.length.toLocaleString('zh-CN')+' 笔，当前选中的有 '+ctx.rows.length.toLocaleString('zh-CN')+' 笔<br>'+
    '金额符号 '+(LL.CUR||'（不显示）')+' · 同一份表重复放进来会自动跳过<br>'+
    '已经记住 '+Object.keys(lsGet(LS.tpl,{})).filter(k=>k.indexOf('__name')<0).length+' 套栏目名';
}
const MAX_PERSIST=50000;
function setRecords(recs,name,type,persist){
  if(persist && recs.length>MAX_PERSIST){
    recs=recs.slice(-MAX_PERSIST);
    toast('账目比较多，本机只留最近 '+MAX_PERSIST.toLocaleString('zh-CN')+' 笔；建议先导出表格存一份');
  }
  state.records=recs; state.sourceName=name; state.sourceType=type; state.page=1;
  state.filters={from:'',to:'',biz:'all',store:'',pay:'',category:'',weekday:'',hour:''};
  state.detailQuery=''; const dq=$('#detailSearch'); if(dq) dq.value='';
  if(persist){
    lsSet(LS.rec,packRecords(recs)); lsSet(LS.meta,{name:name,type:type,ts:Date.now()});
  }
  refreshFilterOptions(); renderAll();
}


/* ===== ui/mapping-modal.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 字段映射弹窗 ---------- */
function openMapping(parsed,meta){
  meta=meta||{};
  state.pending=parsed; state.pendingMeta=meta;
  // XLSX 多工作表切换
  const isXlsx=!!(meta.xlsx && state.xlsxBuf);
  $('#sheetRow').style.display=isXlsx?'flex':'none';
  if(isXlsx){
    const sel=$('#sheetSelect');
    sel.innerHTML=parsed.sheetNames.map((n,i)=>'<option value="'+i+'"'+(i===(parsed.sheetIndex||0)?' selected':'')+'>'+LL.esc(n)+'</option>').join('');
    sel.onchange=function(){
      const idx=parseInt(sel.value,10);
      try{
        const p2=LL.parseXLSX(state.xlsxBuf,idx);
        openMapping(p2,Object.assign({},meta,{sheetIdx:idx}));
        toast('已换到「'+p2.sheetName+'」，栏目重新认了一遍');
      }catch(e){ toast('这张工作表没读出来：'+e.message); }
    };
  }
  // 当前是内置演示数据时默认「替换」，避免把 2.3 万条演示流水混进真实账目
  const isDemo=state.sourceType==='内置演示';
  $('#importMode').value=(!isDemo&&state.records.length)?'append':'replace';
  $('#currencySel').value=LL.CUR;
  const sig=headerSignature(parsed.headers);
  const tpls=lsGet(LS.tpl,{});
  let map=LL.guessMapping(parsed.headers), fromTpl=false;
  if(tpls[sig]){ map=Object.assign({},map,tpls[sig]); fromTpl=true; }
  state.pendingMeta.sig=sig;
  $('#mapSub').textContent='这份表：'+meta.name+(isXlsx?' · 工作表「'+parsed.sheetName+'」':'')+' · '+parsed.rows.length+' 行 · '+parsed.headers.length+' 列'+(fromTpl?' · 已套用上次记住的栏目':'');
  $('#mapNotice').innerHTML=fromTpl
    ? '<b>这套栏目名上次认过，已经自动套上了。</b>要是这次表改了，直接改右边下拉就行，确认后会记新的。'
    : '已经按栏目名猜好了对应关系。<b>日期</b>和<b>金额</b>两栏一定要有，其它空着也能算；确认后会记住这套栏目名。';
  const opts=[-1].concat(parsed.headers.map((_,i)=>i));
  $('#mapGrid').innerHTML=LL.FIELD_DEFS.map(def=>{
    const cur=map[def.key]===undefined?-1:map[def.key];
    return '<div class="map-item '+(def.req?'req':'')+'"><label>'+def.label+(def.req?' <i>*</i>':'')+'</label>'+
      '<span class="alias">常见的叫法：'+LL.esc(def.aliases.slice(0,5).join(' / '))+'</span>'+
      '<select data-key="'+def.key+'">'+opts.map(i=>'<option value="'+i+'"'+(i===cur?' selected':'')+'>'+(i<0?'（这一栏不用）':LL.esc(parsed.headers[i]))+'</option>').join('')+'</select></div>';
  }).join('');
  // 原始预览
  const ph='<thead><tr>'+parsed.headers.map(h=>'<th>'+LL.esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
    parsed.rows.slice(0,5).map(r=>'<tr>'+r.map(c=>'<td>'+LL.esc(String(c).slice(0,24))+'</td>').join('')+'</tr>').join('')+'</tbody>';
  $('#rawPreview').innerHTML=ph;
  const bind=()=>{
    const m={}; $$('#mapGrid select').forEach(s=>m[s.getAttribute('data-key')]=parseInt(s.value,10));
    const res=LL.applyMapping(parsed,m,{source:meta.name,biz:meta.biz||'imported',store:meta.store||''});
    const cols=['date','orderNo','amount','cost','profit','direction','payMethod','category','store'];
    const names=['日期','单号','金额','成本','毛利','方向','支付方式','品类','门店'];
    const fmtCell=(r,c)=>{
      if(c==='amount') return LL.money(r.amount);
      if(c==='cost') return r.cost==null?'—':LL.money(r.cost);
      if(c==='profit'){
        const pr=(r.cost==null||r.direction==='支出')?null:(r.direction==='退款'?r.amount+r.cost:r.amount-r.cost);
        return pr==null?'—':LL.money(pr);
      }
      return String(r[c]==null?'':r[c]);
    };
    $('#mapPreview').innerHTML='<thead><tr>'+names.map(n=>'<th>'+n+'</th>').join('')+'</tr></thead><tbody>'+
      res.records.slice(0,3).map(r=>'<tr>'+cols.map(c=>'<td>'+LL.esc(fmtCell(r,c))+'</td>').join('')+'</tr>').join('')+
      (res.records.length?'':'<tr><td colspan="9" class="empty">没有可解析的行，请检查日期 / 金额列</td></tr>')+'</tbody>'+
      (res.warnings.length?'<caption style="caption-side:bottom;color:#b26a00;font-size:11px;padding:6px">'+LL.esc(res.warnings.join('；'))+'</caption>':'');
    return {m:m,res:res};
  };
  $$('#mapGrid select').forEach(s=>s.addEventListener('change',bind));
  bind();
  $('#btnApplyMap').onclick=function(){
    const {m,res}=bind();
    if(!res.records.length){ toast('没读到能用的账，请检查「日期」和「金额」有没有指对'); return; }
    // 币种只改显示，不做任何数值换算
    LL.CUR=$('#currencySel').value; lsSet(LS.cur,LL.CUR);
    const mode=$('#importMode').value;
    const append=mode==='append' && state.sourceType!=='内置演示' && state.records.length>0;
    const seen=new Set(append?state.records.map(recordFingerprint):[]);
    const added=[]; let dup=0;
    res.records.forEach(r=>{
      const k=recordFingerprint(r);
      if(seen.has(k)){ dup++; return; }
      seen.add(k); added.push(r);
    });
    if(!added.length){
      toast('这 '+res.records.length.toLocaleString('zh-CN')+' 笔跟现在的账完全一样，没有重复加进去');
      return; // 保留映射弹窗，方便用户改选「替换」
    }
    const finalRecs=append?state.records.concat(added):added;
    const displayName=append?((state.sourceName+' + '+meta.name).slice(0,64)):meta.name;
    if($('#chkSaveTpl').checked){
      const all=lsGet(LS.tpl,{}); all[sig]=m; all[sig+'__name']=meta.name; lsSet(LS.tpl,all);
    }
    hideModal('mapModal');
    setRecords(finalRecs,displayName,'字段映射',true);
    toast((append?'已加上 ':'已放进 ')+added.length.toLocaleString('zh-CN')+' 笔'+
      (dup?'，重复的 '+dup.toLocaleString('zh-CN')+' 笔已跳过':'')+
      '，现在一共 '+finalRecs.length.toLocaleString('zh-CN')+' 笔');
  };
  showModal('mapModal');
}

function ingestText(text,name,meta){
  state.xlsxBuf=null;
  const parsed=LL.parseDelimited(text);
  if(!parsed.headers.length||!parsed.rows.length){ toast('没读到表格内容，检查一下是不是复制漏了'); return; }
  openMapping(parsed,Object.assign({name:name},meta||{}));
}
function ingestXlsx(buf,name){
  try{
    state.xlsxBuf=buf instanceof Uint8Array?buf:new Uint8Array(buf);
    const parsed=LL.parseXLSX(state.xlsxBuf,0);
    if(!parsed.headers.length||!parsed.rows.length){ toast('该工作表为空或没有可识别的数据行'); return; }
    openMapping(parsed,{name:name,xlsx:true});
  }catch(e){
    toast('XLSX 解析失败：'+e.message+'（若为 .xls 或加密文件，请另存为 .xlsx / CSV）');
  }
}


/* ===== ui/import.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 载入演示 / 示例 ---------- */
function loadDemo(){
  const recs=LL.generateDemoData();
  setRecords(recs,'三业态演示账目 · 90 天','内置演示',false);
  try{ localStorage.removeItem(LS.rec); localStorage.removeItem(LS.meta); }catch(e){}
  toast('已加载演示账目：超市 / 药店 / 酒店');
}
$$('[data-sample]').forEach(b=>b.addEventListener('click',()=>{
  const k=b.getAttribute('data-sample');
  const biz=k==='pos'?'supermarket':(k==='wechat'?'pharmacy':'hotel');
  const name=k==='pos'?'通用收银日结导出.csv':(k==='wechat'?'微信支付对账单.csv':'支付宝对账单.csv');
  ingestText(LL.buildSampleCSV(k,biz),name,{biz:'imported',store:''});
}));

/* ---------- 文件上传 / 拖放 ---------- */
function handleFiles(files){
  const arr=[...files]; if(!arr.length) return;
  const f=arr[0], name=f.name||'导入文件';
  if(/\.xls$/i.test(name)){
    toast('不支持 Excel 97-2003 的 .xls：请在 Excel 里「另存为 .xlsx 或 CSV」后再导入');
    return;
  }
  if(/\.xlsx$/i.test(name)){
    const rd=new FileReader();
    rd.onload=function(){ ingestXlsx(rd.result,name); };
    rd.onerror=function(){ toast('文件读取失败'); };
    rd.readAsArrayBuffer(f);
    return;
  }
  const rd=new FileReader();
  rd.onload=function(){ ingestText(String(rd.result||''),name,{}); };
  rd.onerror=function(){ toast('文件读取失败'); };
  rd.readAsText(f,'UTF-8');
}
$('#btnPick').addEventListener('click',()=>$('#fileInput').click());
$('#fileInput').addEventListener('change',e=>{ handleFiles(e.target.files); e.target.value=''; });
const dz=$('#dropZone');
dz.addEventListener('click',e=>{ if(e.target.tagName!=='BUTTON') $('#fileInput').click(); });
['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('over');}));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('over');}));
dz.addEventListener('drop',e=>{ if(e.dataTransfer&&e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });

/* ---------- 粘贴 ---------- */
$('#btnPaste').addEventListener('click',()=>{ $('#pasteText').value=''; showModal('pasteModal'); });
$('#btnParsePaste').addEventListener('click',()=>{
  const t=$('#pasteText').value.trim();
  if(!t){ toast('请先粘贴内容'); return; }
  hideModal('pasteModal');
  ingestText(t,'粘贴表格',{});
});

/* ---------- 下载示例 ---------- */
$('#btnSampleCsv').addEventListener('click',()=>{ download('账目导入示例.csv',LL.standardSampleCSV(),'text/csv'); toast('示例 CSV 已下载'); });
$('#btnSampleXlsx').addEventListener('click',()=>{
  try{
    downloadBinary('账目导入示例.xlsx',LL.buildSampleXLSX(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    toast('示例 XLSX 已下载，拖回左侧即可体验多工作表导入');
  }catch(e){ toast('生成失败：'+e.message); }
});
$('#btnDemo').addEventListener('click',loadDemo);
if($('#btnAbout')) $('#btnAbout').addEventListener('click',()=>showModal('aboutModal'));
if($('#btnAboutFromFeat')) $('#btnAboutFromFeat').addEventListener('click',()=>{ hideModal('featuresModal'); showModal('aboutModal'); });
$('#btnGlossary').addEventListener('click',()=>showModal('glossaryModal'));
$('#btnAboutFoot').addEventListener('click',e=>{e.preventDefault();showModal('aboutModal');});
$$('.hero-nav-btn').forEach(b=>b.addEventListener('click',()=>{
  const el=document.getElementById(b.getAttribute('data-jump'));
  if(el){ el.scrollIntoView({behavior:'smooth',block:'start'}); }
}));
$('#btnFeatures').addEventListener('click',()=>showModal('featuresModal'));
$('#btnGuide').addEventListener('click',()=>showGuide(0));
$('#btnPrint').addEventListener('click',()=>window.print());
(function(){ const a=lsGet(LS.author,''); const el=$('#reportAuthor'); if(el) el.value=a||''; })();


/* ===== ui/controls.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 判定标准面板 ---------- */
function fillRulesForm(){
  const groups={};
  LL.RULE_DEFS.forEach(d=>{ (groups[d.group]=groups[d.group]||[]).push(d); });
  $('#rulesGroups').innerHTML=Object.keys(groups).map(g=>
    '<div class="rules-group"><h4>'+LL.esc(g)+'</h4><div class="rules-grid">'+groups[g].map(d=>{
      const v=LL.round(LL.RULES[d.key]*(d.scale||1),2);
      return '<div class="rule-item"><label>'+LL.esc(d.label)+'</label>'+
        '<div class="rule-input"><input type="number" data-rule="'+d.key+'" value="'+v+'" min="'+d.min+'" max="'+d.max+'" step="'+d.step+'"><span>'+d.unit+'</span></div>'+
        '<p>'+LL.esc(d.tip)+'</p></div>';
    }).join('')+'</div></div>').join('');
}
function openRules(){ fillRulesForm(); showModal('rulesModal'); }
if($('#btnRules')) $('#btnRules').addEventListener('click',openRules);
if($('#btnRulesReset')) $('#btnRulesReset').addEventListener('click',()=>{
  LL.RULES=Object.assign({},LL.DEFAULT_RULES); fillRulesForm(); toast('已填回默认值，点「保存并重新算」才生效');
});
if($('#btnRulesSave')) $('#btnRulesSave').addEventListener('click',()=>{
  const obj={};
  $$('#rulesGroups input[data-rule]').forEach(inp=>{
    const d=LL.RULE_DEFS.find(x=>x.key===inp.getAttribute('data-rule'));
    let v=Number(inp.value);
    if(!isFinite(v)) v=d.def*(d.scale||1);
    v=Math.max(d.min,Math.min(d.max,v));
    LL.RULES[d.key]=v/(d.scale||1);
    obj[d.key]=LL.RULES[d.key];
  });
  lsSet(LS.rules,obj); hideModal('rulesModal'); renderAll();
  toast('标准已存到本机，建议和异常都按新标准重算过了');
});
if($('#reportAuthor')) $('#reportAuthor').addEventListener('input',e=>lsSet(LS.author,e.target.value.trim()));

/* ---------- 筛选交互 ---------- */
const bindFilter=(sel,key)=>$(sel).addEventListener('change',e=>{ state.filters[key]=e.target.value; state.page=1; renderAll(); });
bindFilter('#filterFrom','from'); bindFilter('#filterTo','to'); bindFilter('#filterBiz','biz');
bindFilter('#filterStore','store'); bindFilter('#filterPay','pay'); bindFilter('#filterCat','category');
$('#btnResetFilter').addEventListener('click',()=>{
  state.filters={from:'',to:'',biz:'all',store:'',pay:'',category:'',weekday:'',hour:''}; state.page=1;
  refreshFilterOptions(); renderAll(); toast('已恢复看全部账目');
});
$('#btnClearData').addEventListener('click',()=>{
  try{ localStorage.removeItem(LS.rec); localStorage.removeItem(LS.meta); }catch(e){}
  loadDemo(); toast('已清空你放进来的账，回到示例；记住的栏目名还在');
});
$$('#segTrend button').forEach(b=>b.addEventListener('click',()=>{
  $$('#segTrend button').forEach(x=>x.classList.remove('on')); b.classList.add('on');
  state.trendMode=b.getAttribute('data-v'); if(state.ctx) renderCharts(state.ctx);
}));
$$('#segCat button').forEach(b=>b.addEventListener('click',()=>{
  $$('#segCat button').forEach(x=>x.classList.remove('on')); b.classList.add('on');
  state.catMode=b.getAttribute('data-v'); if(state.ctx) renderCharts(state.ctx);
}));
$('#btnPrev').addEventListener('click',()=>{ if(state.page>1){state.page--;renderDetail(state.ctx);} });
$('#btnNext').addEventListener('click',()=>{ state.page++; renderDetail(state.ctx); });
(function(){
  const box=$('#detailSearch');
  if(box) box.addEventListener('input',e=>{ state.detailQuery=e.target.value; state.page=1; if(state.ctx) renderDetail(state.ctx); });
  const clr=$('#btnClearSearch');
  if(clr) clr.addEventListener('click',()=>{ state.detailQuery=''; const b=$('#detailSearch'); if(b) b.value=''; state.page=1; if(state.ctx) renderDetail(state.ctx); });
})();


/* ===== ui/export.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 导出 ---------- */
$('#btnExportCsv').addEventListener('click',()=>{
  if(!state.ctx||!state.ctx.rows.length){ toast('按现在选的条件没有账可导出'); return; }
  const head=['日期','时间','单号','收/退','金额','进价','赚的差价','怎么付的','哪类东西','商品/明细','数量','门店','哪门生意','会员号','来自哪份表'];
  const q=s=>{const t=String(s==null?'':s);return /[",\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t;};
  const pr=r=>r.cost==null||r.direction==='支出'?null:(r.direction==='退款'?r.amount+r.cost:r.amount-r.cost);
  const lines=[head.join(',')].concat(state.ctx.rows.map(r=>[r.date,r.time,r.orderNo,r.direction,r.amount,r.cost==null?'':r.cost,pr(r)==null?'':LL.round(pr(r),2),r.payMethod,r.category,r.item,r.qty,r.store,(LL.BIZ[r.biz]?LL.BIZ[r.biz].name:r.biz),r.member,r.src].map(q).join(',')));
  download('账目明细_'+state.filters.from+'_'+state.filters.to+'.csv',lines.join('\n'),'text/csv');
  toast('每一笔账的表格已导出');
});
$('#btnReport').addEventListener('click',()=>{
  if(!state.ctx){ toast('先放一份账目进来，再导出'); return; }
  const ctx=state.ctx;
  const imgs={};
  ['chartTrend','chartPay','chartCat','chartProfit','chartHour','chartWeek','chartStore','chartRefund'].forEach(id=>{
    try{ imgs[id]=$('#'+id).toDataURL('image/png'); }catch(e){ imgs[id]=''; }
  });
  const card=(title,img)=>'<div class="c"><h3>'+title+'</h3>'+(img?'<img src="'+img+'">':'')+'</div>';
  const kpis=[['实际进账',LL.money(ctx.net,true)],['赚的差价',ctx.hasCost?LL.money(ctx.grossProfit,true):'—'],
    ['差价占比',(ctx.hasCost&&ctx.grossMargin!==null)?LL.pct(ctx.grossMargin,1):'—'],['进货成本',ctx.hasCost?LL.money(ctx.costTotal,true):'—'],
    ['一共多少单',ctx.orders.toLocaleString('zh-CN')],['客人平均花多少',LL.money(ctx.avgTicket)],
    ['退回去多少',LL.pct(ctx.refundRate,2)],['平均每天进账',LL.money(ctx.dailyAvg,true)],
    ['每天稳不稳',String(LL.round(ctx.cv,2))],['有进价的账占多少',ctx.hasCost?LL.pct(ctx.costCoverage):'—']];
  const sugAll=state.allSuggestions||state.suggestions;
  const doneList=sugAll.filter(x=>x._state==='done'), ignList=sugAll.filter(x=>x._state==='ignored');
  const todoList=sugAll.filter(x=>!x._state);
  const sugHtml=todoList.map((s,i)=>'<div class="s"><span class="lv '+s.level+'">'+LL.LEVEL_TEXT[s.level]+'</span>'+
    (s._state?'<span class="s-tag">'+LL.esc(s._state==='done'?'✓ 已处理':'⊘ 先不看')+'</span>':'')+
    '<h4>'+(i+1)+'. '+LL.esc(s.title)+'</h4><p><b>为什么这么说：</b>'+LL.esc(s.evidence)+'</p><p><b>可以怎么做：</b>'+LL.esc(s.advice)+'</p>'+
    (s._st?sugSnapshotText(s._st,ctx):'')+'</div>').join('');
  const doneHtml=doneList.length?('<h2>四、已经处理过的事</h2>'+doneList.map(x=>
    '<div class="s s-done"><h4>✓ '+LL.esc(x.title)+'</h4><p>标记时间：'+LL.esc(x._st.at)+'</p>'+sugSnapshotText(x._st,ctx)+'</div>').join('')):'';
  const author=(lsGet(LS.author,'')||$('#reportAuthor').value||'').trim()||'（未填）';
  const storeName=state.filters.store||($('#filterStore').selectedOptions[0]?$('#filterStore').selectedOptions[0].text:'')||'全部门店';
  const bizName=$('#filterBiz').selectedOptions[0].text;
  const extra=[];
  if(state.filters.pay) extra.push('收款方式：'+state.filters.pay);
  if(state.filters.category) extra.push('只看：'+state.filters.category);
  if(state.filters.weekday!==''&&state.filters.weekday!=null) extra.push('只看'+LL.WEEK_NAMES[Number(state.filters.weekday)]);
  if(state.filters.hour!==''&&state.filters.hour!=null) extra.push('只看 '+String(state.filters.hour).padStart(2,'0')+':00');
  const cond=extra.length?extra.join(' · '):'没有额外条件，看的是全部账目';
  const conclusion=$('#heroTitle').textContent;
  const coverNums=[['一共收进',LL.money(ctx.sales,true)],['实际留下',LL.money(ctx.net,true)],
    ['一共做了',ctx.orders.toLocaleString('zh-CN')+' 单'],['客人平均花',LL.money(ctx.avgTicket)]];
  const html='<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>账镜 · '+LL.esc(storeName)+' 账目结论单</title><style>'+
    'body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#16233a;max-width:1000px;margin:0 auto;padding:32px;line-height:1.7}'+
    'h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:30px 0 12px;border-bottom:2px solid #2563eb;padding-bottom:6px}'+
    '.cover{background:linear-gradient(135deg,#122a52,#1d4ed8);color:#fff;border-radius:14px;padding:26px 28px;margin-bottom:26px;break-inside:avoid}'+
    '.cover .kick{font-size:12px;letter-spacing:2px;color:#bfdbfe;font-weight:700}'+
    '.cover h1{font-size:26px;margin:8px 0 10px;color:#fff;border:0;padding:0}'+
    '.cover .cmeta{font-size:12.5px;color:#e0ecff;line-height:2}'+
    '.cover .cconcl{background:rgba(255,255,255,.14);border-radius:9px;padding:11px 14px;font-size:15px;font-weight:700;margin:14px 0;line-height:1.75}'+
    '.cover .cnums{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}'+
    '.cover .cnums div{background:rgba(255,255,255,.14);border-radius:8px;padding:9px 11px}'+
    '.cover .cnums span{display:block;font-size:11px;color:#dbeafe}.cover .cnums b{display:block;font-size:19px;margin-top:2px}'+
    '.cover .cfoot{margin-top:12px;font-size:12px;color:#dbeafe}'+
    '.meta{color:#465976;font-size:12.5px;margin-bottom:18px}.k{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}'+
    '.k div{background:#f4f6fb;border-radius:8px;padding:12px}.k b{display:block;font-size:20px}.k span{font-size:11px;color:#465976}'+
    '.c{border:1px solid #e5eaf3;border-radius:10px;padding:12px;margin-bottom:12px;break-inside:avoid}.c h3{font-size:13px;margin:0 0 8px}.c img{width:100%;display:block}'+
    '.s{border-left:3px solid #f59e0b;background:#fbfcfe;padding:12px 14px;margin-bottom:10px;border-radius:0 8px 8px 0;break-inside:avoid}'+
    '.s.high{border-color:#ef4444}.s.good{border-color:#10b981}.s.low{border-color:#0ea5e9}.s-done{border-color:#10b981}'+
    '.s h4{font-size:14px;margin:4px 0}.s p{font-size:12.5px;margin:5px 0;color:#243650}'+
    '.s-tag{font-size:11px;margin-left:8px;background:#e7f8f1;color:#07845c;padding:2px 7px;border-radius:4px;font-weight:700}'+
    '.sug-diff{font-size:12px;color:#243650;background:#f2f7ff;padding:7px 10px;border-radius:6px;margin-top:7px;line-height:1.7}'+
    '.lv{font-size:10px;padding:2px 7px;border-radius:4px;background:#fff4e0;color:#b26a00}.s.high .lv{background:#feecec;color:#c92a2a}.s.good .lv{background:#e7f8f1;color:#07845c}.s.low .lv{background:#e8f4fe;color:#0369a1}'+
    '.note{font-size:11.5px;color:#465976;background:#f8fafd;padding:12px;border-radius:8px;margin-top:24px}'+
    '@media print{body{padding:0}.s,.c,.cover{break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}}'+
    '</style></head><body>'+
    '<div class="cover"><div class="kick">账镜 · 这份账说明了什么</div>'+
    '<h1>'+LL.esc(storeName)+' · 这段时间账目说明</h1>'+
    '<div class="cmeta">统计区间：'+state.filters.from+' ~ '+state.filters.to+'　|　对比区间：'+LL.esc(ctx.compareMode)+'<br>'+
    '生意类型：'+LL.esc(bizName)+'　|　当前条件：'+LL.esc(cond)+'<br>'+
    '账目来源：'+LL.esc(state.sourceName)+'　|　共 '+ctx.rows.length.toLocaleString('zh-CN')+' 笔　|　制表人：'+LL.esc(author)+'　|　生成时间：'+new Date().toLocaleString('zh-CN')+'</div>'+
    '<div class="cconcl">'+LL.esc(conclusion)+'</div>'+
    '<div class="cnums">'+coverNums.map(x=>'<div><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('')+'</div>'+
    '<div class="cfoot">待办建议 '+sugAll.filter(x=>!x._state).length+' 条 · 已处理 '+doneList.length+' 条 · 先不看 '+ignList.length+' 条　|　金额符号 '+(LL.CUR||'（不显示）')+'，按表里原值显示，没有换算汇率</div></div>'+
    '<h2>一、先看这几个数</h2><div class="k">'+kpis.map(k=>'<div><span>'+k[0]+'</span><b>'+k[1]+'</b></div>').join('')+'</div>'+
    '<p style="font-size:12.5px;color:#243650">跟哪段时间比：'+LL.esc(ctx.compareMode)+'。进账变化 <b>'+LL.pct(ctx.chgNet)+'</b>，客人平均消费变化 <b>'+LL.pct(ctx.chgTicket)+'</b>，单数变化 <b>'+LL.pct(ctx.chgOrders)+'</b>。</p>'+
    '<h2>二、这 8 张图在说什么</h2>'+
    card('每天进账多少，是在变好还是变差',imgs.chartTrend)+card('客人都是怎么付钱的',imgs.chartPay)+card('哪类东西最卖钱',imgs.chartCat)+
    card('哪类东西最赚差价',imgs.chartProfit)+card('一天里几点最忙',imgs.chartHour)+card('周几生意最好',imgs.chartWeek)+
    card('哪家店 / 哪门生意做得好',imgs.chartStore)+card('退款主要出在哪类东西',imgs.chartRefund)+
    '<h2>三、接下来可以做的几件事（待办 '+todoList.length+' 条）</h2>'+(todoList.length?sugHtml:'<p>待办都清完了。</p>')+
    doneHtml+
    '<div class="note">怎么算的（大白话）：收进来的钱扣掉退款和支出，就是「实际进账」；除以单数，就是「客人平均花多少」。'+
    '<b>赚的差价</b>只算记了进价的那部分账：卖价减进价，客人退货时再把当时那份成本加回来。没记进价的先放在一边，<b>不会当成不要钱</b>；这次有 '+LL.pct(ctx.costCoverage)+' 的账记了进价。'+
    '注意：差价还没扣房租、人工、水电、平台抽成，不等于最后落到口袋的钱。'+
    '特别高、特别低、特别大的单子只是按当前「判定标准」挑出来提醒核对，不一定是错账；标准可由制表人在「⚙ 判定标准」里调整。'+
    '这份报告是在你自己的电脑里生成的，账目没有上传，请结合实际情况看。</div>'+
    '</body></html>';
  download('账镜_账目结论单_'+state.filters.from+'_'+state.filters.to+'.html',html,'text/html');
  toast('结论已导出，双击打开就能看，也能直接打印');

});

['chartTrend','chartPay','chartCat','chartProfit','chartHour','chartWeek','chartStore','chartRefund'].forEach(id=>{
  const cv=document.getElementById(id);
  if(cv) cv.addEventListener('click',e=>{ if(typeof cv._pick==='function') applyDrill(id,cv._pick(e)); });
});


/* ===== ui/guide.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 使用演示：4 步可操作引导 ---------- */
const GUIDE=[
  {
    tab:'① 先看效果',
    title:'第 1 步 · 不用准备任何东西，先看看它长什么样',
    lead:'现在页面上已经有一份示例账目了。它不是你的真实数据，只是让你先看看「账放进来之后会变成什么样」。',
    do:'点下面这个按钮，把示例账目重新装一遍。',
    bullets:[
      '你会看到最上面有一段<b>大白话结论</b>：一共收了多少钱、实际留下多少、最该先处理哪件事。',
      '往下是 8 个数字、8 张图，还有几条「可以怎么做」的建议。',
      '整个页面不用联网、不用登录，看完心里先有个底。'
    ],
    see:'点完按钮后，回到页面往上看那段深蓝色的结论就行。',
    tip:'不用担心弄坏什么：这一步只是换一份示例数据，随时可以再点一次。',
    action:'▦ 装一遍示例账目',
    fn:()=>{ loadDemo(); toast('示例账目已装好，往上看看那段蓝色结论'); }
  },
  {
    tab:'② 放自己的表',
    title:'第 2 步 · 换成你自己的账目表',
    lead:'超市、药店、酒店，每家收银系统导出的表格长得都不一样，栏目名也各不相同。这一步就是让你看看：不一样也没关系。',
    do:'点下面这个按钮，会打开一份「超市日结表」做示范。',
    bullets:[
      '弹出来的是一张<b>栏目对照表</b>：左边是我们要的「日期、金额、进价、门店…」，右边是这份表自己写的栏目名。',
      '大多数栏目它已经替你认好了，<b>你只要扫一眼、改错的地方</b>，再点「确认并分析」。',
      '同一家系统以后再导出，栏目名一样，就会直接套用这次记下的对照，不用再认一遍。'
    ],
    see:'确认之后，页面上的数字和图会全部换成这份表算出来的结果。',
    tip:'<b>想看「赚了多少」，重点确认「进价 / 成本」那一栏有没有对上。</b>没对上也没关系，收了多少钱照样能看，只是赚的差价会显示「—」，不会瞎猜一个数。',
    action:'▤ 打开一张示范表，看看栏目怎么对',
    fn:()=>{
      hideModal('guideModal');
      ingestText(LL.buildSampleCSV('pos','supermarket'),'超市收银日结表.csv',{biz:'imported'});
    }
  },
  {
    tab:'③ 看懂数字',
    title:'第 3 步 · 看懂「收了多少」和「赚了多少」不是一回事',
    lead:'这是最容易弄混的地方。收进来的钱，要扣掉退回去的，再扣掉进货成本，剩下的才叫赚的差价。',
    do:'点下面这个按钮，把两张图切成「赚的差价」视角。',
    bullets:[
      '第一张图会从「每天进账多少」变成「每天赚了多少差价」。',
      '「哪类东西最卖钱」那张图，会变成按<b>差价占比</b>排 —— 常会发现卖得最多的，不一定最赚。',
      '下面还有一张「哪类东西最赚差价」，<b>红色柱子表示卖一件亏一件</b>，最该先查。'
    ],
    see:'按钮点完会自动滚到那张图，并闪一下提醒你在哪。',
    tip:'看不懂「毛利」「差价占比」这些词？点右上角<b>「这些词啥意思」</b>，全是大白话解释。<b>点图上的柱子还能只看那一类</b>，点完左边出现小标签，点 × 就退回来。',
    action:'◩ 切到「赚的差价」看看',
    fn:()=>{
      hideModal('guideModal');
      ['segTrend','segCat'].forEach(id=>$$('#'+id+' button').forEach(x=>x.classList.remove('on')));
      const t=$('#segTrend button[data-v="profit"]'), c=$('#segCat button[data-v="margin"]');
      if(t)t.classList.add('on'); if(c)c.classList.add('on');
      state.trendMode='profit'; state.catMode='margin';
      if(state.ctx) renderCharts(state.ctx);
      const el=$('#boxProfit'); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1600); }
      toast('已切到「赚的差价」，红色柱子是卖一件亏一件的');
    }
  },
  {
    tab:'④ 拿走结论',
    title:'第 4 步 · 把这份结论带走',
    lead:'看完之后，通常会想发给合伙人、店长，或者存起来下周对比。不用截图，一键就能导出一份完整的报告。',
    do:'点下面这个按钮，会下载一个网页文件。',
    bullets:[
      '报告第一页是一张<b>封面</b>：门店、时间、对比区间、制表人、一句话结论、4 个大数字都在上面；后面才是数字、8 张图和建议。双击就能打开，不用联网，也能直接打印。',
      '想自己再算一遍，可以点「导出表格」，拿到每一笔账的明细（含进价和赚的差价）；也可以在明细区<b>直接搜单号或商品名</b>。',
      '想只打印当前这一页，点「打印」就行。报告里还会单独列一节「已经处理过的事」，方便下周回看。'
    ],
    see:'下载完打开看看：跟页面上是同一份结论，只是能离线带走。',
    tip:'你的账目<b>只在这台电脑里算</b>，不会被传到网上。看完不想要了，点左栏「清空我的账目，回到示例」即可。',
    action:'↓ 导出一份完整结论',
    fn:()=>{ hideModal('guideModal'); $('#btnReport').click(); }
  }
];

function renderGuide(){
  $('#guideTabs').innerHTML=GUIDE.map((g,i)=>'<button data-step="'+i+'" class="'+(i===state.guideStep?'on':'')+'">'+g.tab+'</button>').join('');
  $$('#guideTabs button').forEach(b=>b.addEventListener('click',()=>{state.guideStep=+b.getAttribute('data-step');renderGuide();}));
  const g=GUIDE[state.guideStep];
  $('#guideBody').innerHTML='<h4>'+g.title+'</h4><p class="lead">'+g.lead+'</p>'+
    '<div class="step-do">👉 <b>这一步做什么：</b>'+g.do+'</div>'+
    '<ul>'+g.bullets.map(x=>'<li>'+x+'</li>').join('')+'</ul>'+
    '<div class="step-see"><b>点完会看到：</b>'+g.see+'</div>'+
    '<div class="tip">'+g.tip+'</div><button class="btn primary" id="guideAction">'+g.action+'</button>';
  $('#guideAction').addEventListener('click',g.fn);
  $('#btnGuidePrev').disabled=state.guideStep===0;
  $('#btnGuideNext').disabled=state.guideStep===GUIDE.length-1;
}
function showGuide(step){ clearTimeout(toastTimer); $('#tooltip').style.display='none'; state.guideStep=Math.max(0,Math.min(step||0,GUIDE.length-1)); renderGuide(); showModal('guideModal'); }
function closeGuide(){ if($('#chkNoGuide').checked) lsSet(LS.guide,true); hideModal('guideModal'); }
$('#btnGuideX').addEventListener('click',closeGuide);
$('#btnGuideClose').addEventListener('click',closeGuide);
$('#btnGuidePrev').addEventListener('click',()=>{ if(state.guideStep>0){state.guideStep--;renderGuide();} });
$('#btnGuideNext').addEventListener('click',()=>{ if(state.guideStep<GUIDE.length-1){state.guideStep++;renderGuide();} });


/* ===== ui/boot.js ===== */
/* UI 分片：由 build.mjs 按 manifest.json 顺序拼进同一个作用域，
   共享 LL / $ / state / 各渲染函数，因此不写 import/export。 */

/* ---------- 启动 ---------- */
function boot(){
  LL.CUR=lsGet(LS.cur, (globalThis.__LEDGERLENS__ && globalThis.__LEDGERLENS__.defaultCurrency) || '¥');
  const saved=lsGet(LS.rec,null), meta=lsGet(LS.meta,null);
  if(saved&&saved.length){
    const recs=Array.isArray(saved[0])?unpackRecords(saved):saved;
    setRecords(recs,(meta&&meta.name)||'上次导入的数据',(meta&&meta.type)||'导入数据',false);
  }else{
    loadDemo();
  }
  if(!lsGet(LS.guide,false)) setTimeout(()=>showGuide(0),420);
}
let rt=null;
window.addEventListener('resize',()=>{ clearTimeout(rt); rt=setTimeout(()=>{ if(state.ctx) renderCharts(state.ctx); },180); });
boot();

})();
