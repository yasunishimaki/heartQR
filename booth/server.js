// server.js — 展示ブース向け助成金マッチングアプリ
import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ========== 助成金データベース ==========
const SUBSIDIES = [
  {
    "id": "DB-001",
    "name": "人材開発支援助成金（人への投資促進コース）",
    "theme": "リスキリング",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "75%",
    "maxAmount": "1,500,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "雇用保険適用事業所。デジタル・高度人材育成、自発的訓練を実施する事業主。OFF-JT訓練経費要件あり。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html"
  },
  {
    "id": "DB-002",
    "name": "人材開発支援助成金（事業展開等リスキリング支援コース）",
    "theme": "リスキリング",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "75%",
    "maxAmount": "1,500,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "雇用保険適用事業所。新たな事業展開・暖化・定着に伴う人材育成訓練。訓練実施計画の事前届出必要。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html"
  },
  {
    "id": "DB-003",
    "name": "人材開発支援助成金（人材育成支援コース）",
    "theme": "人材育成・リスキリング",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "75%",
    "maxAmount": "1,000,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "雇用保険適用事業所。OFF-JT訓練経費と訓練中賃金を助成。小規模事業主は高い助成率。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html"
  },
  {
    "id": "DB-004",
    "name": "キャリアアップ助成金（正社員化コース）",
    "theme": "人材育成・リスキリング",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "要確認",
    "maxAmount": "574,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "有期雇用労働者等（契約社員・パート・派遣社員）を正社員化する事業主。小規模従業員は1人当たり57.4万円（中小企業）。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html"
  },
  {
    "id": "DB-005",
    "name": "人材確保等支援助成金（テレワークコース）",
    "theme": "働き方改革・労務管理",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "要確認",
    "maxAmount": "350,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "中小企業事業主。テレワーク制度の導入・実施。導入助成：20万円、目標達成助成：10～15万円。評価期間中に全労働者が1回以上実施が条件。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/telework_zyosei_R3.html"
  },
  {
    "id": "DB-006",
    "name": "両立支援等助成金（育休中等業務代替支援コース）",
    "theme": "働き方改革・労務管理",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "要確認",
    "maxAmount": "1,250,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "中小企業事業主。育霧休業中の業務代替を行った場合に助成。味方代替・新規雇用代替の2類型。最大90日分の賝金等を助成。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html"
  },
  {
    "id": "DB-007",
    "name": "産業雇用安定助成金（スキルアップ支援コース）",
    "theme": "リスキリング",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "67%",
    "maxAmount": "10,000,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "在籍型出向を通じたスキルアップ。小規模・中小企業主。復帰後賃金５％以上向上要件。企業グループ内出向は対象外。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000082805_00012.html"
  },
  {
    "id": "DB-008",
    "name": "業務改善助成金",
    "theme": "働き方改革・労務管理",
    "subtheme": "",
    "targetSize": "小規模",
    "rate": "90%",
    "maxAmount": "6,000,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "事業場内の最低賃金を引き上げた中小企業・小規模事業者。設備・機械・システム導入による業務効率化が対象。助成率：雇入規模によら75%～90%。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html"
  },
  {
    "id": "DB-009",
    "name": "IT導入補助金2025",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "4,500,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "中小企業・小規模事業者等。ITツール導入による業務効率化・DXを目的とする事業主。登録済ITツールスロットからの申請必要。",
    "priority": "中",
    "url": "https://www.it-hojo.jp/"
  },
  {
    "id": "DB-010",
    "name": "モノヅクリ・商業・サービス高付加価値改善・生産性向上促進補助金（モノヅクリ補助金）",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "12,500,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "中小企業・小規模事業者。革新的な製品・サービス開発や生産プロセス改善を目的とする設備投資。DX投資條件許可型は最大12,500万円。",
    "priority": "中",
    "url": "https://portal.monodukuri-hojo.jp/"
  },
  {
    "id": "DB-011",
    "name": "小規模事業者持続化補助金",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "小規模",
    "rate": "67%",
    "maxAmount": "2,000,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "商工会議所等の会員である小規模事業者（20人以下）。販路開拓・IT導入・展示会出展等の販販促進全般が対象。",
    "priority": "中",
    "url": "https://www.jizokukahojokin.info/"
  },
  {
    "id": "DB-012",
    "name": "人材確保等支援助成金（雇用管理制度・雇用環境整備助成コース）",
    "theme": "働き方改革・労務管理",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "要確認",
    "maxAmount": "570,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "雇用管理制度（評価・研修・月払・受入島等）を導入し、離職率下減成果を達成した中小企業。基本垣助成：57万円。加算助成あり。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000199292_00005.html"
  },
  {
    "id": "DB-013",
    "name": "東京都 中小企業デジタル化支援助成金（サンプル）",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "1,000,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "都内に主たる事業所を有する中小企業者。デジタル導入による業務効率化・DX推進。",
    "priority": "中",
    "url": "https://www.tokyo-kosha.or.jp/"
  },
  {
    "id": "DB-014",
    "name": "中小企業省力化投資補助金（カタログ注文型）",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "15,000,000円",
    "status": "公募中",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "人手不足に悩む中小企業・小規模事業者。IoT・ロボット等のかたぐ設備をカタログから選択。第6回公募（R8.3～5月）。GBIペzID必要。",
    "priority": "中",
    "url": "https://shoryokuka.smrj.go.jp/"
  },
  {
    "id": "DB-015",
    "name": "働き方改革推進支援助成金（労働時間短縮・年休促進支援コース）",
    "theme": "働き方改革・労務管理",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "75%",
    "maxAmount": "1,500,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "労災保適用中小企業事業主。就業規則整備・認識等大取組、設備導入を実施。対象経費の3/4（労働者数により上限変動）。年休斈得促進など成果目標設定必要。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120692.html"
  },
  {
    "id": "DB-016",
    "name": "働き方改革推進支援助成金（勤務間インターバル導入コース）",
    "theme": "働き方改革・労務管理",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "75%",
    "maxAmount": "1,200,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "労災保適用中小企業事業主。造業自動化・システム導入による最低インターバル9時間以上の確保。導入新規型は上限150万円（11時間以上）。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000150891.html"
  },
  {
    "id": "DB-017",
    "name": "東京都 DX推進助成金（生産性向上コース）",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "30,000,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "都内中小企業・個人事業主・中小企業団体。公社のDXアドバイザーによる支援・提案書が必須（最低3ヶ月要）。機器・ロボット・システム・ソフトウェア・クラウド利用費等。",
    "priority": "中",
    "url": "https://iot-robot.jp/business/dxsubsidy/"
  },
  {
    "id": "DB-018",
    "name": "東京都 中小企業デジタルツール導入促進支援事業",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "1,000,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "都内中小企業等（会社・個人事業主・中小企業団体）。デジタルツール新規導入・カスタマイズ費用。汎用ソフトウェア・ハードウェアを除く。jGrants申請必要。",
    "priority": "中",
    "url": "https://www.tokyo-kosha.or.jp/support/josei/jigyo/digital-tool.html"
  },
  {
    "id": "DB-019",
    "name": "東京都 緊急デジタル技術活用推進助成金",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "80%",
    "maxAmount": "30,000,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "都内中小企業等。ICT・AI・ロボット等のデジタル技術導入・活用。設備・機械・システム構築・ソフトウェア・クラウド利用費等が対象。",
    "priority": "中",
    "url": "https://iot-robot.jp/business/dx2024-02/"
  },
  {
    "id": "DB-020",
    "name": "大阪府中小企業従業員人材育成支援補助金（リスキリング支援補助金）",
    "theme": "リスキリング",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "75%",
    "maxAmount": "200,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "府内中小企業等。社外研修機関の研修を従業員に受講させた企業。国の人材開発支援助成金対象外（10時間未満等）の研修を補完。デジタル系研修は75%助成。",
    "priority": "中",
    "url": "https://www.pref.osaka.lg.jp/o110110/01jinzai_jinnzaiikuseisienhojokin.html"
  },
  {
    "id": "DB-021",
    "name": "令和7年度 新事業展開テイクオフ補助金",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "1,500,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "大阪府内に本店または主たる事業所を有する中小企業等（待機中およし00者程度）。新規事業進出または省力化投資に取り組む事業。指定セミナー受講必須。",
    "priority": "中",
    "url": "https://www.pref.osaka.lg.jp/o110050/keieishien/takeoffr7/index.html"
  },
  {
    "id": "DB-022",
    "name": "神戸市中小企業DX推進支援補助制度",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "2,500,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "神戸市内中小企業。DXお助け隊事業の伴走型支援を複数回受けていることが必須。システム導入・デジタル環境整備・製品サービス開発が対象。",
    "priority": "中",
    "url": "https://www.city.kobe.lg.jp/a93457/2025dxhojo.html"
  },
  {
    "id": "DB-023",
    "name": "多様な働き方推進支援事業（テレワーク型・環境整備型）",
    "theme": "働き方改革・労務管理",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "2,000,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "常時雇用労働者300人以下の兵庫県内中小企業。テレワークを初めて整備する事業主が対象。PC・タブレットリース料、ソフトウェア購入費、ネットワーク設定等が対象。",
    "priority": "中",
    "url": "https://web.pref.hyogo.lg.jp/sr05/r6/tayounahatarakikatasuisinsienn.html"
  },
  {
    "id": "DB-024",
    "name": "京都市デジタル化推進プロジェクト",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "80%",
    "maxAmount": "1,000,000円",
    "status": "公募中",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "京都市内の中小企業・個人事業主・組合・団体等。業務効率化・生産性向上のためのデジタル化に取り組む事業。デジタル導入枠：4/5、デジタル展開枠：2/3。",
    "priority": "中",
    "url": "https://kyotocity-digital-pjt.com/"
  },
  {
    "id": "DB-025",
    "name": "京都府 多様な働き方推進事業費補助金（テレワークコース）",
    "theme": "働き方改革・労務管理",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "500,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "業種別に資本金・従業員数基準ありの中小企業。テレワークを新規導入する企業のみ対象（既導入企業不可）。眇7ウィズ実施行動宣言が必須条件。複数事業者共同備考。",
    "priority": "中",
    "url": "https://www.pref.kyoto.jp/rosei/tayounahatarakikata.html"
  },
  {
    "id": "DB-026",
    "name": "和歌山市 デジタルツール導入支援補助金",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "400,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "和歌山市内に主たる事務所または事業所を有する中小企業者。市税完納、過去2年間の本補助金受給なしが条件。IT・IoTツール導入は5年後労働生産性伸率20％以上が条件。",
    "priority": "中",
    "url": "https://www.city.wakayama.wakayama.jp/1016047/sangyoukigyousien/1048409/1051288.html"
  },
  {
    "id": "DB-027",
    "name": "企業のDX推進補助金（滑賀県産業支援プラザ）",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "2,000,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "製造業または製造業関連産業で滑賀県内に事業拠点を有する中小・小規模企業。IoT機器・AIソフトウェア等の導入（環境整備）と外部専門家指導・教育訓練（人材育成）が対象。",
    "priority": "中",
    "url": "https://www.shigaplaza.or.jp/service/dx/"
  },
  {
    "id": "DB-028",
    "name": "令和8年度 中小企業デジタル化・DX促進補助金",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "67%",
    "maxAmount": "2,000,000円",
    "status": "公募中（締切間近）",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "県内に事業所を有する中小・小規模企業者。「あいち産業DX推進コンソーシアム」加入が必須。デジタルツール導入・実証、コンサルティング、システム構築・改修費用が対象。",
    "priority": "中",
    "url": "https://dx-hojo.aibsc.jp/"
  },
  {
    "id": "DB-029",
    "name": "名古屋市 中小企業デジタル活用支援補助金",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "1,500,000円",
    "status": "公募中",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "名古屋市内中小企業者。販路開拓・生産性向上により賣上げを含む経営課題解決を目指す事業。申請前に同公社または名古屋商工会議所での事前相談が必須。",
    "priority": "中",
    "url": "https://www.nipc.or.jp/digitalgrants/"
  },
  {
    "id": "DB-030",
    "name": "デジタル化・AI導入補助金2026（IT導入補助金後継）",
    "theme": "DX・AI活用",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "67%",
    "maxAmount": "4,500,000円",
    "status": "公募中",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "中小企業・小規模事業者・個人事業主。生成AI・業務自動化AIツール導入が優先支援対象。ソフトウェア購入・クラウド利用料（2年分）・導入コンサル・研修費が対象。HP・動画制作は対象外。",
    "priority": "中",
    "url": "https://it-shien.smrj.go.jp/"
  },
  {
    "id": "DB-031",
    "name": "トライアル雇用助成金（一般トライアルコース）",
    "theme": "採用支援",
    "subtheme": "",
    "targetSize": "小規模",
    "rate": "要確認",
    "maxAmount": "150,000円",
    "status": "通年",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "雇用保険適用事業所。業種・規模制限なし。ハローワーク等の紹介による就職困難求職者を試行雇用（帶期カメ最南3か月）。母子平家庭の母等は月入5万円（最大15万円）。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/newpage_16286.html"
  },
  {
    "id": "DB-032",
    "name": "特定求職者雇用開発助成金（特定就職困難者コース）",
    "theme": "採用支援",
    "subtheme": "",
    "targetSize": "小規模",
    "rate": "要確認",
    "maxAmount": "600,000円",
    "status": "通年",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "業種・規模制限なし。ハローワーク等紹介による60歳以上高年齢者・障害者・母子家庭の母等の雇入れ。高年齢者・母子家庭の母等は最大60万円（1年間）。パート・短時間労働者も対象。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/tokutei_konnan.html"
  },
  {
    "id": "DB-033",
    "name": "６５歳超雇用推進助成金（65歳超継続雇用促進コース）",
    "theme": "採用支援",
    "subtheme": "",
    "targetSize": "小規模",
    "rate": "要確認",
    "maxAmount": "2,400,000円",
    "status": "通年",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "業種・規模制限なし。６５歳以上への定年引上げ・定年廃止・継続雇用制度導入を行った事業主。被保険者数１～３人の小規模でも１５万～６０万円。定年廃止は最大240万円。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/newpage_52738.html"
  },
  {
    "id": "DB-034",
    "name": "人材開発支援助成金（教育訓練休暇等付与コース）",
    "theme": "人材育成・リスキリング",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "要確認",
    "maxAmount": "600,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "雇用保険適用事業所。有給教育訓練休暇制度を導入し従業員が自発的に訓練を受ける仕組みを整備した事業主。キャリアコンサルタント活用企業には年間訓練提供が助成要件。導入実績等に応じて４７５万～60万円。",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html"
  },
  {
    "id": "DB-035",
    "name": "中小企業新事業進出補助金（事業再構築補助金後継）",
    "theme": "販路開拓・PR",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "90,000,000円",
    "status": "公募中",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "日本国内に本社・補助事業実施場所を持つ中小企業・小規模企業者。新視市場進出・販路開拓・路線変更を目的とする設備投資。広告宣伝・販販促進費は売上見込額の5％制限。第4回（最終）公募。",
    "priority": "中",
    "url": "https://shinjigyou-shinshutsu.smrj.go.jp/"
  },
  {
    "id": "DB-036",
    "name": "展示会出展助成プラス",
    "theme": "販路開拓・PR",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "67%",
    "maxAmount": "1,500,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "都内中小企業等。公社の「活力向上プロジェクトアドバンスプラス」での経営分析の実績が应募要件。展示会出展費（小間料・資材・輸送）、EC出店初期登録料、HP・動画・印刷物・広告急費が対象。",
    "priority": "中",
    "url": "https://www.tokyo-kosha.or.jp/support/josei/jigyo/r7tenjikai.html"
  },
  {
    "id": "DB-037",
    "name": "市場開拓助成事業",
    "theme": "販路開拓・PR",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "3,000,000円",
    "status": "公募中",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "都内中小企業等。「活力工・販・サプライコア認定」等規定の認定企業または成長産業分野に限定。展示会出展費、サイト制作・改修費、印刷物制作・動画制作費、広告掌載料が対象。",
    "priority": "中",
    "url": "https://www.tokyo-kosha.or.jp/support/josei/jigyo/shijo.html"
  },
  {
    "id": "DB-038",
    "name": "中小企業展示商談会出展支援事業費補助金",
    "theme": "販路開拓・PR",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "67%",
    "maxAmount": "780,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "府内に主たる事業所を持つ中小企業（中小企業基本法第2条規定）。BtoB展示商談会への出展。出展小間料金のみ対象（販促物制作費は対象外）。最低1小間税抜15万円以上が条件。",
    "priority": "中",
    "url": "https://www.pref.osaka.lg.jp/o110070/mono/syuttenshien-rinji.html"
  },
  {
    "id": "DB-039",
    "name": "国内展示会出展助成事業（神奈川産業振興センター）",
    "theme": "販路開拓・PR",
    "subtheme": "",
    "targetSize": "中小企業",
    "rate": "50%",
    "maxAmount": "1,000,000円",
    "status": "受付終了",
    "useCase": "",
    "serviceIdea": "",
    "conditions": "県内に主たる事業所を持つ中小企業。全国規模の展示会出展に伴う展示小間費・ブース設指費・輸送費等が対象。パンフレット・展示品制作料も対象贈。",
    "priority": "中",
    "url": "https://www.kipc.or.jp/topics/information/domestic-expo-support-2025/"
  },
  {
    "id": "PRV-001",
    "name": "小規模事業者持続化補助金＜一般型　通常枠＞",
    "theme": "販路開拓・業務効率化",
    "subtheme": "IT化支援、ウェブサイト制作、展示会出展、広報費",
    "targetSize": "小規模事業者",
    "rate": "2/3以内",
    "maxAmount": "50万円（特例枠は最大200万円）",
    "status": "公募中",
    "useCase": "小規模事業者がホームページ作成・予約システム・EC導入など初めてのIT化を検討している初期相談時",
    "serviceIdea": "ホームページ制作、予約管理システム（STORES予約等）、クラウドPOS（Airレジ）、SNS広告費",
    "conditions": "商工会議所・商工会の事業支援計画書（様式4）取得が必要",
    "priority": "高",
    "url": "https://r6.jizokukahojokin.info/"
  },
  {
    "id": "PRV-002",
    "name": "中小企業組合等課題対応支援事業（中小企業組合等活路開拓事業）",
    "theme": "販路開拓・新事業・人材育成",
    "subtheme": "組合活動強化、IT化、展示会出展、組合員研修",
    "targetSize": "事業協同組合・商工組合など中小企業の連携組織",
    "rate": "要確認（事業内容により異なる）",
    "maxAmount": "要確認",
    "status": "公募中",
    "useCase": "業界団体・組合を通じた加盟中小企業向けの研修や販路開拓活動の提案時",
    "serviceIdea": "業界向けクラウドシステム導入支援、共同IT化支援、組合員向け研修プログラム",
    "conditions": "事業協同組合・商工組合などの連携組織が申請主体",
    "priority": "中",
    "url": "https://www.chuokai.or.jp/index.php/subsidy/subsidykadai/"
  },
  {
    "id": "PRV-003",
    "name": "中小企業新事業進出補助金",
    "theme": "新事業展開・販路開拓",
    "subtheme": "新市場進出、展示会出展、広告宣伝、サービス開発",
    "targetSize": "中小企業・小規模事業者",
    "rate": "1/2以内（一部2/3）",
    "maxAmount": "従業員規模により最大9,000万円",
    "status": "公募中",
    "useCase": "中小企業が新しい市場・顧客層への進出・展示会出展を検討している段階での提案",
    "serviceIdea": "EC構築、デジタルマーケティング支援、新サービス開発ツール、展示会出展支援",
    "conditions": "新たな市場への進出を前提とした事業計画が必要",
    "priority": "高",
    "url": "https://shinjigyou-shinshutsu.smrj.go.jp/"
  },
  {
    "id": "PRV-004",
    "name": "中小企業成長加速化補助金",
    "theme": "設備投資・事業拡大",
    "subtheme": "売上100億円を目指す大規模投資、DX・生産性向上",
    "targetSize": "中小企業（売上高10億円以上100億円未満）",
    "rate": "1/2以内",
    "maxAmount": "5億円",
    "status": "受付前",
    "useCase": "中規模成長企業が大型設備投資・DX投資を検討している際の融資・補助金提案時",
    "serviceIdea": "基幹システム刷新（ERP）、大型製造設備DX、スマートファクトリー導入",
    "conditions": "売上100億円宣言ポータルへの公表必要、5年間の事業計画、賃上げ要件",
    "priority": "中",
    "url": "https://growth-100-oku.smrj.go.jp/"
  },
  {
    "id": "PRV-005",
    "name": "働き方改革推進支援助成金（労働時間短縮・年休促進支援コース）",
    "theme": "働き方改革・労務管理",
    "subtheme": "勤怠管理システム、労務管理ソフト、年休促進、時短",
    "targetSize": "中小企業（常時使用労働者数による）",
    "rate": "3/4以内（条件により4/5）",
    "maxAmount": "最大1,000万円（業種・取組内容により変動）",
    "status": "未確認",
    "useCase": "勤怠管理・シフト管理のIT化や残業削減に取り組む中小企業への提案時",
    "serviceIdea": "勤怠管理システム（KING OF TIME、ジョブカン等）、シフト管理ツール、給与計算ソフト（弥生給与等）",
    "conditions": "労働時間削減等の取組実施と成果達成が必要",
    "priority": "高",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120692.html"
  },
  {
    "id": "PRV-006",
    "name": "産業雇用安定助成金（スキルアップ支援コース）",
    "theme": "人材育成・リスキリング",
    "subtheme": "在籍型出向によるスキルアップ、出向コスト補助",
    "targetSize": "中小企業・大企業",
    "rate": "中小企業2/3、中小企業以外1/2",
    "maxAmount": "1人1日8,635円・1事業所年間最大1,000万円",
    "status": "通年",
    "useCase": "人材を一時的に他社に出向させながらスキルアップさせたい企業や、出向受け入れで人材確保したい企業への提案時",
    "serviceIdea": "人材マッチングサービス、在籍型出向マッチング（産業雇用安定センター無料活用）",
    "conditions": "在籍型出向を行い、復帰後に賃金が出向前比5%以上上昇した事業主（出向元）",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000082805_00012.html"
  },
  {
    "id": "PRV-007",
    "name": "人材開発支援助成金（キャリア形成支援制度導入コース）",
    "theme": "リスキリング・キャリア支援",
    "subtheme": "セルフ・キャリアドック導入、教育訓練休暇制度、キャリアコンサルタント活用",
    "targetSize": "雇用保険適用事業主",
    "rate": "定額助成",
    "maxAmount": "47.5万円（生産性要件達成時60万円）",
    "status": "通年",
    "useCase": "従業員のキャリア支援・1on1面談・キャリアコンサルタント活用を検討している人事担当者への提案時",
    "serviceIdea": "キャリアコンサルティングサービス、1on1支援ツール、タレントマネジメントシステム（カオナビ等）",
    "conditions": "セルフ・キャリアドック制度または教育訓練休暇等制度を新たに導入し、従業員に実施した事業主",
    "priority": "中",
    "url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html"
  },
  {
    "id": "PRV-008",
    "name": "市場開拓助成事業",
    "theme": "販路開拓",
    "subtheme": "展示会出展、EC出店、販売促進物作成、動画・広告",
    "targetSize": "中小企業",
    "rate": "1/2以内",
    "maxAmount": "300万円",
    "status": "受付前",
    "useCase": "東京都内企業が展示会出展・EC・広告で販路拡大を検討している際の提案時",
    "serviceIdea": "EC構築支援（BASE、Shopify等）、展示会ブース制作、動画マーケティング支援",
    "conditions": "東京都・公社の事業で評価・認定を受けた製品・サービス所有、またはイノベーションマップ対象分野",
    "priority": "高",
    "url": "https://www.tokyo-kosha.or.jp/support/josei/jigyo/shijo.html"
  },
  {
    "id": "PRV-009",
    "name": "国内展示会出展助成事業",
    "theme": "販路開拓",
    "subtheme": "国内展示会出展、新規取引先開拓",
    "targetSize": "中小企業",
    "rate": "1/2以内（テクニカルショウヨコハマ以外）",
    "maxAmount": "30万円（テクニカルショウヨコハマ実績ありは上限30万円、なしは25万円）",
    "status": "受付終了",
    "useCase": "神奈川県内の製造業・ものづくり企業が展示会出展で販路開拓を検討している際の提案時",
    "serviceIdea": "展示会ブース制作、PR資材作成支援、テクニカルショウヨコハマ出展支援",
    "conditions": "神奈川県内に1年以上事業を営む中小企業、自社製品・サービスを単独出展",
    "priority": "中",
    "url": "https://www.kipc.or.jp/topics/information/domestic-expo-support-2025/"
  },
  {
    "id": "PRV-010",
    "name": "デジタル化・AI導入補助金",
    "theme": "DX・AI活用",
    "subtheme": "生成AI導入、SaaS、クラウド、業務自動化、デジタル化全般",
    "targetSize": "中小企業・小規模事業者",
    "rate": "要確認（枠により異なる）",
    "maxAmount": "最大450万円（枠により変動）",
    "status": "公募中",
    "useCase": "生成AI・クラウドサービス・SaaS導入を検討している中小企業への初期相談時に最優先で案内できる補助金",
    "serviceIdea": "生成AI（ChatGPT Team等）、クラウド会計（freee・MFクラウド）、勤怠管理（KING OF TIME）、ワークフロー、CRM",
    "conditions": "gBizID等の要件、3年間の事業計画、労働生産性3%以上向上目標",
    "priority": "高",
    "url": "https://hojyokin-portal.jp/columns/degital_ai_summary"
  }
];

// 課題カテゴリ → マッチングテーマキーワード
const CHALLENGE_THEME_MAP = {
  dx_automation: ["DX・AI活用", "省力化", "DX・業務効率化", "業務効率化", "DX"],
  skill_training: ["リスキリング", "人材育成・リスキリング", "リスキリング・キャリア支援", "人材育成・リスキリング", "販路開拓・新事業・人材育成"],
  hiring: ["採用支援"],
  workstyle: ["働き方改革・労務管理"],
  sales_expansion: ["販路開拓・PR", "販路開拓・業務効率化", "新事業展開・販路開拓", "販路開拓", "販路開拓・新事業・人材育成"],
  digitalization: ["DX・AI活用", "DX・業務効率化", "DX"],
};

// 企業規模フィルタ
const SIZE_MATCH = {
  small: ["小規模事業者", "中小企業", "中小・小規模", "幅広い", "全規模"],
  medium: ["中小企業", "中小・小規模", "幅広い", "全規模", "中堅・大企業"],
  large: ["大企業", "幅広い", "全規模", "中堅・大企業"],
};

function matchSubsidies(challenges, companySize) {
  const targetThemes = new Set();
  for (const ch of challenges) {
    const themes = CHALLENGE_THEME_MAP[ch] || [];
    themes.forEach((t) => targetThemes.add(t));
  }

  const sizeKeywords = SIZE_MATCH[companySize] || SIZE_MATCH.medium;

  const matched = SUBSIDIES.filter((s) => {
    const themeMatch = [...targetThemes].some(
      (t) => s.theme.includes(t) || t.includes(s.theme)
    );
    const sizeMatch =
      !s.targetSize ||
      sizeKeywords.some((k) => s.targetSize.includes(k)) ||
      s.targetSize.includes("全規模") ||
      s.targetSize.includes("幅広い") ||
      s.targetSize.includes("要確認");
    return themeMatch && sizeMatch;
  });

  // 優先度順: 高 > 中 > 低, 公募中 > 通年 > others
  const priorityScore = { 高: 3, 中: 2, 低: 1 };
  const statusScore = { 公募中: 3, "公募中（締切間近）": 3, 通年: 2, 受付前: 1, 受付終了: 0 };

  matched.sort((a, b) => {
    const ps = (priorityScore[b.priority] || 1) - (priorityScore[a.priority] || 1);
    if (ps !== 0) return ps;
    return (statusScore[b.status] || 0) - (statusScore[a.status] || 0);
  });

  return matched.slice(0, 6);
}

// ========== API エンドポイント ==========
app.post("/api/match", async (req, res) => {
  const { challenges = [], companySize = "medium" } = req.body;

  if (!challenges.length) {
    return res.status(400).json({ error: "課題を選択してください" });
  }

  const matched = matchSubsidies(challenges, companySize);

  const challengeLabels = {
    dx_automation: "人手不足・業務の自動化",
    skill_training: "社員の育成・スキルアップ",
    hiring: "採用・雇用の改善",
    workstyle: "働き方改革・残業削減",
    sales_expansion: "新規顧客開拓・販路拡大",
    digitalization: "デジタル化・DX推進",
  };
  const sizeLabels = { small: "小規模事業者", medium: "中小企業", large: "大企業・中堅企業" };

  const challengeText = challenges.map((c) => challengeLabels[c] || c).join("、");
  const sizeText = sizeLabels[companySize] || companySize;

  const subsidyList = matched
    .map(
      (s, i) =>
        `【${i + 1}】${s.name}\n  補助率: ${s.rate || "要確認"} / 上限: ${s.maxAmount || "要確認"} / 状況: ${s.status}\n  条件: ${s.conditions || "要問い合わせ"}`
    )
    .join("\n\n");

  const prompt = matched.length
    ? `あなたは中小企業向けの助成金・補助金活用の専門コンサルタントです。

【企業規模】${sizeText}
【解決したい課題】${challengeText}

【マッチした助成金・補助金】
${subsidyList}

上記の情報をもとに、以下の構成で具体的な活用提案を日本語で作成してください：

1. **課題分析**（2〜3文）：企業が直面している課題の本質を簡潔に整理
2. **おすすめ活用プラン**（箇条書き、各助成金の活用シーン・組み合わせ方を具体的に）
3. **期待できる効果**（費用削減額の目安・業務改善効果など数値イメージを含めて）
4. **次のアクション**（今すぐできる2ステップ）

展示ブースでの対話を想定し、わかりやすく、前向きな提案トーンで記述してください。`
    : `企業規模：${sizeText}、課題：${challengeText}について、現在マッチする公募中の助成金は見つかりませんでしたが、今後活用できる制度を踏まえた一般的なアドバイスを3つ提供してください。`;

  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Send subsidy data immediately
    res.write(`data: ${JSON.stringify({ type: "subsidies", subsidies: matched })}\n\n`);

    // Stream Claude proposal
    const stream = await client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 1500,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ type: "text", text: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (err) {
    console.error("Claude API error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "提案の生成に失敗しました" });
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
      res.end();
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Booth app running at http://localhost:${PORT}`);
});
