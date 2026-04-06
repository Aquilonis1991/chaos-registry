Pod::Spec.new do |s|
  s.name = 'VotechaosNativeAdPlugin'
  s.version = '0.1.0'
  s.summary = 'Capacitor Native Ad bridge for ChaosRegistry'
  s.license = 'MIT'
  s.homepage = 'https://votechaos.app'
  s.author = 'ChaosRegistry'
  s.source = { :git => 'https://example.com/native-ad-plugin.git', :tag => s.version.to_s }
  s.source_files = 'ios/Plugin/**/*.{swift,h,m}'
  s.static_framework = true
  s.dependency 'Capacitor'
  s.dependency 'Google-Mobile-Ads-SDK'
end

