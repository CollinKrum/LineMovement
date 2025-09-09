import React from "react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div style={{display:"grid",placeItems:"center",minHeight:"100vh",gap:"0.75rem",textAlign:"center"}}>
      <h1 style={{fontSize:"2rem",fontWeight:700,margin:0}}>Page not found</h1>
      <p style={{opacity:0.7,margin:0}}>Sorry, we couldn’t find what you’re looking for.</p>
      <Link href="/">
        <a style={{marginTop:"0.5rem",textDecoration:"underline"}}>Go home</a>
      </Link>
    </div>
  );
}
