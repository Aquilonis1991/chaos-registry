package com.votechaos.app;

import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;
import com.votechaos.nativead.NativeAdPlugin;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "VoteChaos";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        try {
            Log.d(TAG, "MainActivity onCreate start");
            registerPlugin(NativeAdPlugin.class);
            super.onCreate(savedInstanceState);
            Log.d(TAG, "MainActivity onCreate complete");
        } catch (Exception e) {
            Log.e(TAG, "Fatal error in onCreate", e);
            Toast.makeText(this, "啟動失敗: " + e.getMessage(), Toast.LENGTH_LONG).show();
            throw e;
        }
    }
    
    @Override
    public void onStart() {
        try {
            Log.d(TAG, "MainActivity onStart");
            super.onStart();
        } catch (Exception e) {
            Log.e(TAG, "Error in onStart", e);
            throw e;
        }
    }
    
    @Override
    public void onResume() {
        try {
            Log.d(TAG, "MainActivity onResume");
            super.onResume();
        } catch (Exception e) {
            Log.e(TAG, "Error in onResume", e);
            throw e;
        }
    }
}
