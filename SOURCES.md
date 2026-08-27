# Sources

Every claim on the page, and the link that substantiates it.

A **deep link** is a URL whose page states the figure. A publisher's front door is
not a deep link. This file exists so that a claim can never quietly lose its
source.

`Verified` means:

| Value | Meaning |
| --- | --- |
| `yes` | The linked page states the figure. |
| `derived` | The figure is worked out from the linked pages. The arithmetic is in the note. |
| `disagrees` | The publisher's own figure is not the figure on the page. Listed for a decision. |
| `unverified` | No page states the figure. The link names the best available publisher. |

Checked on 2026-08-27. Run `npm run data:links` to re-test that every URL answers.

---

## Section two: the basket

| Claim | Figure | Link | Verified | Note |
| --- | --- | --- | --- | --- |
| Chipotle burrito | $11.50 | [Chipotle menu](https://www.chipotle.com/order) | `disagrees` | Chipotle publishes no national average. Store-level surveys in August 2026 put a chicken burrito at $9.79 to $10.75. |
| Month of average US rent | $1,780 | [Zillow Observed Rent Index](https://www.zillow.com/research/data/) | `yes` | ZORI is downloaded from this page. |
| Week of groceries, family of four | $265 | [USDA food plans, monthly cost of food](https://www.fns.usda.gov/cnpp/usda-food-plans-cost-food-monthly-reports) | `yes` | Moderate-cost plan. |
| Round-trip domestic flight | $400 | [BTS average domestic air fare](https://www.bts.gov/air-fares) | `yes` | |
| Year of in-state public college | $11,800 | [College Board, Trends in College Pricing](https://research.collegeboard.org/trends/college-pricing) | `yes` | |
| Used car, average price | $26,500 | [Cox Automotive, Q2 2026 Manheim index](https://www.coxautoinc.com/insights/q2-2026-muvvi/) | `yes` | Cox says listing prices "climbed back toward $27,000". |
| Down payment on a median US home | $41,500 | [Zillow research data](https://www.zillow.com/research/data/) | `derived` | 10% of a $415,000 median. |
| Full tank of gas | $48 | [EIA weekly retail gasoline prices](https://www.eia.gov/petroleum/gasdiesel/) | `yes` | |
| Month of childcare, one child | $1,099 | [Child Care Aware, price of care 2025](https://info.childcareaware.org/price-and-supply-2025) | `yes` | |
| Year of student loan payments | $6,036 | [Education Data Initiative](https://educationdata.org/average-student-loan-payment) | `yes` | Secondary aggregator, not a primary publisher. |
| Funeral with viewing and burial | $9,170 | [NFDA 2023 General Price List Study](https://content.nfda.org/news/media-center/nfda-news-releases/id/8134/2023-nfda-general-price-list-study-shows-inflation-increasing-faster-than-the-cost-of-a-funeral) | `disagrees` | NFDA's own published median is $8,300. $9,170 is a third-party inflation adjustment of it. |
| Household's share of health premiums | $6,850 | [KFF 2025 Employer Health Benefits Survey](https://www.kff.org/health-costs/2025-employer-health-benefits-survey/) | `yes` | The worker's share of family coverage. Single coverage is $1,440. |
| Average American wedding | $33,000 | [The Knot 2026 Real Weddings Study](https://www.theknotww.com/press-releases/the-knot-worldwide-unveils-2026-real-weddings-study) | `disagrees` | $33,000 was the 2024 figure. The Knot's 2025 average is $34,000. |

## Section three: the receipt and the donut

All 17 receipt cards and all 10 donut slices already carried a source. The
renderer threw the 10 slice links away; that is fixed.

| Claim | Figure | Link | Verified | Note |
| --- | --- | --- | --- | --- |
| Every donut slice | FY2025 outlays | [Final Monthly Treasury Statement, September 2025](https://fiscaldata.treasury.gov/static-data/published-reports/mts/MonthlyTreasuryStatement_202509.pdf) | `yes` | Table 5, net outlays by agency. Was the dataset front page. |
| 155mm artillery shell | $3,000 | [FY2026 Procurement of Ammunition, Army](https://www.asafm.army.mil/Portals/72/Documents/BudgetMaterial/2026/Discretionary%20Budget/Procurement/Procurement%20of%20Ammunition.pdf) | `unverified` | Was a Wikipedia article. This is the right primary source; the per-round figure moves with the buy quantity. |

Every other receipt card links to a GAO report, a CBO publication, a CRS report,
the Federal Register, a Supreme Court case or the publisher's own study. Those
were already deep links and are unchanged.

## Section five: the ladder

| Claim | Figure | Link | Verified | Note |
| --- | --- | --- | --- | --- |
| Year of a parent's care | $74,400 | [CareScout 2025 Cost of Care Survey](https://investor.genworth.com/news-events/press-releases/detail/1054/carescout-releases-2025-cost-of-care-survey-results) | `yes` | $6,200 a month, the national median for assisted living. |
| Child raised to eighteen | $332,000 | [USDA, the cost of raising a child](https://www.usda.gov/about-usda/news/blog/cost-raising-child) and [BLS CPI inflation calculator](https://www.bls.gov/data/inflation_calculator.htm) | `derived` | USDA's figure is $233,610 in 2015 dollars, for a middle-income married couple, birth through age 17. Carried forward by CPI it is about $322,000 in mid-2025 and about $332,000 today. |
| Used car, owned outright | $26,500 | [Cox Automotive, Q2 2026 Manheim index](https://www.coxautoinc.com/insights/q2-2026-muvvi/) | `yes` | Same figure as the basket card. |
| "Draw four percent a year" | 4% | [Bengen, Determining Withdrawal Rates Using Historical Data (1994)](https://www.financialplanningassociation.org/sites/default/files/2021-04/MAR04%20Determining%20Withdrawal%20Rates%20Using%20Historical%20Data.pdf) | `yes` | The original SAFEMAX paper. Applies to `scholarship` and `never-work`. |
| "Most American households do not have this" | 3 months of expenses | [Fed, Economic Well-Being of U.S. Households in 2025](https://www.federalreserve.gov/publications/2026-economic-well-being-of-us-households-in-2025-savings-investments.htm) | `yes` | 37% of adults could not cover a $400 emergency with cash. |
| "The county sells the house if you stop paying it" | — | [Tyler v. Hennepin County, 598 U.S. 631 (2023)](https://supreme.justia.com/cases/federal/us/598/22-166/) | `yes` | The Court assumed tax foreclosure and sale, and limited only the keeping of surplus equity. |
| GiveDirectly delivers 89 cents of the dollar | 89% | [GiveDirectly financials](https://www.givedirectly.org/financials) | `yes` | 89% of cash-transfer funds reached recipients since inception. |

Rungs with a `priceFrom` block take their price from another file and inherit
that file's source. They need none of their own.

## The give

All six charity rungs already linked to GiveWell or UNICEF. Unchanged.

One note for a future refresh: GiveWell's current **marginal** cost per life
saved through the Top Charities Fund is about $8,000, above every figure on this
page. The $5,500 on the `life-amf` rung is the Against Malaria Foundation average
for 2022-2024 grants, which is what the note says.

## Section six: roads

| Claim | Figure | Link | Verified | Note |
| --- | --- | --- | --- | --- |
| California high-speed rail, per mile | $215,204,678 | [California High-Speed Rail Authority](https://hsr.ca.gov/project-overview/) | `yes` | |
| Brightline West, per mile | $98,623,853 | [Bloomberg, October 2025](https://www.bloomberg.com/news/articles/2025-10-01/california-to-vegas-high-speed-rail-costs-jump-by-5-5-billion) | `yes` | Paywalled. |
| FAA, per IFR flight hour | $586.41 | [FAA Air Traffic Organization](https://www.faa.gov/about/office_org/headquarters_offices/ato) | `unverified` | **The FAA publishes no page stating this.** See the warning below. |
| NAV CANADA, per IFR flight hour | $369.44 | [Reason Foundation](https://reason.org/commentary/canada-offers-important-lessons-for-u-s-air-traffic-control/) | `yes` | |
| Space Launch System, per kg | $43,158 | [NASA OIG, IG-22-003](https://oig.nasa.gov/wp-content/uploads/2024/02/IG-22-003.pdf) | `yes` | |
| Falcon Heavy, per kg | $2,351 | [SpaceX, Falcon Heavy](https://www.spacex.com/vehicles/falcon-heavy/) | `yes` | |

## Assumptions, rates and slider defaults

| Claim | Figure | Link | Verified | Note |
| --- | --- | --- | --- | --- |
| Combined sales tax rate | 7.5% | [Tax Foundation, sales tax rates midyear 2026](https://taxfoundation.org/data/all/state/2026-sales-tax-rates-midyear/) | `yes` | Population-weighted average is 7.53%. |
| Share of take-home spent on taxable goods | 35% | [BLS Consumer Expenditure Survey tables](https://www.bls.gov/cex/tables.htm) | `unverified` | The page already calls this an editorial estimate. No publisher states 35%. |
| Long-run annual return | 7% | [S&P 500 real return since 1926](https://www.officialdata.org/us/stocks/s-p-500/1926) | `yes` | About 10.2% nominal, about 7.0% after inflation. |
| Federal brackets and standard deductions | 2026 | [IRS, tax inflation adjustments for tax year 2026](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill) | `yes` | Revenue Procedure 2025-32. Standard deductions $16,100 / $32,200 / $24,150 match the data file exactly. |
| Social Security wage base | $184,500 | [SSA, contribution and benefit base](https://www.ssa.gov/oact/cola/cbb.html) | `yes` | Announced 24 October 2025. |
| State income tax rates | per state | [Tax Foundation, state income tax rates](https://taxfoundation.org/data/all/state/state-income-tax-rates/) | `yes` | A flat approximation, as note 2 says. |
| Median home value, per state | per state | [Zillow research data](https://www.zillow.com/research/data/) | `yes` | ZHVI, fetched by the `zillow-zhvi` updater. |

## Prose claims

| Claim | Where | Link | Verified |
| --- | --- | --- | --- |
| State tax is a flat approximation | Note 2 | [Tax Foundation, state income tax rates](https://taxfoundation.org/data/all/state/state-income-tax-rates/) | `yes` |
| The payroll tax has two halves at 6.2% each | Note 6 | [SSA, contribution and benefit base](https://www.ssa.gov/oact/cola/cbb.html) | `yes` |
| GiveWell expects its figures to rise | Note 7 | [GiveWell, how much does it cost to save a life](https://www.givewell.org/how-much-does-it-cost-to-save-a-life) | `yes` |
| Most economists accept the incidence argument | Note 8 | [CBO Working Paper 2021-06](https://www.cbo.gov/publication/57089) | `yes` |
| The figures used | Note 11 | [IRS tax year 2026 adjustments](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill) | `yes` |
| Box numbers refer to the real form | Section one hint | [IRS, About Form W-2](https://www.irs.gov/forms-pubs/about-form-w-2) | `yes` |

Notes 1, 3, 4, 5, 9 and 10 are caveats about the model. Section six's lede and
caveat are argument. None of them states a figure, so none of them takes a link.

---

## Warnings

Three figures do not match what their publisher says. **They are unchanged in the
data.** Changing a number is a separate decision.

1. **Chipotle burrito, $11.50.** Store-level surveys of thousands of US
   locations in August 2026 give $9.79 to $10.75. Chipotle publishes no national
   average, so no authoritative figure exists either way.
2. **Wedding, $33,000.** That is The Knot's 2024 average. Their 2025 average,
   published February 2026, is $34,000.
3. **Funeral, $9,170.** The NFDA's own published median is $8,300, from the 2023
   General Price List Study. $9,170 is a third-party inflation adjustment of
   that figure, not an NFDA number.

One card cannot be substantiated at all.

4. **FAA, $586.41 per IFR flight hour.** The FAA does not publish this metric on
   any public page. The figure comes from the same Reason Foundation analysis
   already cited for the NAV CANADA price. Worse, that analysis puts FAA system
   costs 8% to 34% above NAV CANADA between 2009 and 2023. The card's two prices
   imply a gap of 59%. The card either needs a source that carries both numbers
   for one year, or it needs to come off the page.
