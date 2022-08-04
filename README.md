# Warframe-Clock-for-Wallpaper-Engine
A Warframe themed web-wallpaper that displays a clock, inspired by the Plains of Eidolon in game timer, and a timer for Baro Ki'teer's next arrival.

-> [Open web preview](https://zappic3.github.io/Warframe-Clock-for-Wallpaper-Engine)

-> [Try it out on Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=2742776809)

![2022-08-04 14_41_14-Steam](https://user-images.githubusercontent.com/79416867/182860588-f3a33b5e-9783-465e-89da-8d29c29ef64c.png)

## Function
The clock uses your local computer time, while the Baro Ki'teer timer loads Baro's arrival time and planet from the Warframstatus Void Trader API.
(https://api.warframestat.us/pc/voidTrader)

Because of this, the Baro Ki'teer Timer requires an internet connection. For more convenience, the loaded data is locally stored. In the end, the wallpaper only requires every 12 - 14 days an internet connection. When required data can't be loaded, this warning will be displayed:

![image](https://user-images.githubusercontent.com/79416867/182865272-2cf92f96-8283-4df2-9e77-b0f265fc7454.png)

## Customization
When you use this project with Wallpaper Engine, you can customize it via the Wallpaper Engine menu.
Customizing the Wallpaper settings is probably required, because this wallpaper neither scales nor positions itself automatically. 
Even the Baro Ki'teer Timer can be hidden, if you don't like it. 

![image](https://user-images.githubusercontent.com/79416867/182892025-89b91d22-dadc-4d2f-9cfe-c9156c9d5a98.png)

## Disclaimer & Info
- This is my first JS project, so the code is pretty janky. Especially the networking.
- The Baro Animations are a little bit weird, I know.
- Known Error: When Baro returns, and the wallpaper is reloaded, the planet isn't displayed correctly.
- If you're having issues with this wallpaper, try clearing the local storage by checking the "[Clear Local Storage]" checkbox. 
  (see picture above)
- [More Informations on Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=2742776809)
 
## [You can try this Wallpaper out on Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=2742776809)

***

License: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)
