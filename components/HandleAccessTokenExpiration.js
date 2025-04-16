import React, { useState, useEffect } from "react";
import axios from "axios";

const handleAccessTokenExpiration = async () => {
  const refreshToken = localStorage.getItem("refresh_token");
  const clientId = process.env.API_CLIENT_ID;
  const clientSecret =process.env.API_CLIENT_SECRET;

  try {
    const response = await axios.post("https://oauth2.googleapis.com/token", {
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token"
    });

    const accessToken = response.data.access_token;
    localStorage.setItem("access_token", accessToken);
    return accessToken;
  } catch (err) {
    console.error(err);
    return null;
  }
};

export default handleAccessTokenExpiration;
