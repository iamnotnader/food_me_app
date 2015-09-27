package io.foodme;

import android.app.Application;

import com.parse.Parse;
import com.parse.ParseInstallation;

public class MainApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();

        Parse.initialize(this, "1nX0o0NEF3uUaM3eKZUEz70qv3er0YimVVAM75ER",
                "pmh3Wt8MMi9rN7XJcsvWMktBJxKTqSFOdzNyTihn");
        ParseInstallation.getCurrentInstallation().saveInBackground();

        System.out.println("Questionably worked.");
        ParseInstallation.getCurrentInstallation().saveInBackground();
    }
}