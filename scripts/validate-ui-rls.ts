import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

async function main(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY,publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key||!publishable)throw new Error("Missing Supabase environment");
  const admin=createClient(url,key,{auth:{persistSession:false}}), created:string[]=[];
  try{
    const users=[];
    for(const suffix of ["a","b"]){const email=`task14-${suffix}-${randomUUID()}@invalid.local`,password=`${randomUUID()}Aa1!`;const{data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error||!data.user)throw new Error(error?.message??"User creation failed");created.push(data.user.id);const client=createClient(url,publishable,{auth:{persistSession:false}});const{error:signInError}=await client.auth.signInWithPassword({email,password});if(signInError)throw new Error(signInError.message);users.push({id:data.user.id,client});}
    const profileIds:string[]=[],portfolioIds:string[]=[];
    for(let i=0;i<users.length;i++){
      const profile={user_id:users[i].id,profile_name:`Task 14 RLS ${i}-${randomUUID()}`,investment_horizon_years:10,investment_goal:"VALIDATION",goal_flexibility:3,risk_willingness_score:4,risk_capacity_score:4,liquidity_need_score:2,initial_amount:10000,monthly_contribution:1000,investment_mode:"MONTHLY",account_type:"ASK",management_style_preference:"ANY",cost_sensitivity:3,currency_hedging_preference:"ANY",esg_importance:3,target_fund_count:3,max_fund_count:5,max_weight_per_fund:.5,min_weight_per_fund:.1,tactical_view_enabled:false};
      const{data:p,error:pe}=await users[i].client.from("user_profiles").insert(profile).select("id").single();if(pe)throw new Error(`Profile insert: ${pe.message}`);profileIds.push(p.id);
      const{data:portfolio,error:poe}=await users[i].client.from("portfolios").insert({user_id:users[i].id,name:`RLS portfolio ${i}`,base_currency:"NOK"}).select("id").single();if(poe)throw new Error(`Portfolio insert: ${poe.message}`);portfolioIds.push(portfolio.id);
    }
    const{data:fund,error:fundError}=await admin.from("funds").select("id").limit(1).single();if(fundError)throw new Error(fundError.message);
    for(let i=0;i<users.length;i++){const{error}=await users[i].client.from("transactions").insert({client_transaction_id:`rls-${i}`,portfolio_id:portfolioIds[i],fund_id:fund.id,transaction_type:"BUY",trade_date:"2026-10-12",amount:1000,nav:100,units:10,currency:"NOK",fees:0,source:"MANUAL"});if(error)throw new Error(`Transaction insert: ${error.message}`);}
    const checks=[];
    for(let i=0;i<users.length;i++){const other=i===0?1:0;const[{data:ownProfiles},{data:otherProfiles},{data:ownPortfolios},{data:otherPortfolios},{data:ownTransactions},{data:otherTransactions}]=await Promise.all([users[i].client.from("user_profiles").select("id").eq("id",profileIds[i]),users[i].client.from("user_profiles").select("id").eq("id",profileIds[other]),users[i].client.from("portfolios").select("id").eq("id",portfolioIds[i]),users[i].client.from("portfolios").select("id").eq("id",portfolioIds[other]),users[i].client.from("transactions").select("id").eq("portfolio_id",portfolioIds[i]),users[i].client.from("transactions").select("id").eq("portfolio_id",portfolioIds[other])]);const result={user:i===0?"A":"B",ownProfile:ownProfiles?.length===1,otherProfileBlocked:otherProfiles?.length===0,ownPortfolio:ownPortfolios?.length===1,otherPortfolioBlocked:otherPortfolios?.length===0,ownTransaction:ownTransactions?.length===1,otherTransactionBlocked:otherTransactions?.length===0};if(Object.values(result).slice(1).some(x=>x!==true))throw new Error(`RLS isolation failed: ${JSON.stringify(result)}`);checks.push(result);}
    console.log(JSON.stringify({status:"PASS",checks},null,2));
  }finally{for(const id of created){const{error}=await admin.auth.admin.deleteUser(id);if(error)throw new Error(`Cleanup failed: ${error.message}`)}}
}
void main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
