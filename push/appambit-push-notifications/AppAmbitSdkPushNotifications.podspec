require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "AppAmbitSdkPushNotifications"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/AppAmbit/appambit-sdk-react-native.git", :tag => "#{s.version}" }

  s.default_subspec = 'Core'

  s.subspec 'Core' do |core|
    core.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
    core.exclude_files = "ios/AppAmbitRNNotificationService.swift"
    core.private_header_files = "ios/**/*.h"
    core.frameworks = 'Network'
    core.dependency 'AppAmbitPushNotifications', '~> 1.0.0'
    core.dependency 'AppAmbitSdk'
    install_modules_dependencies(core)
  end

  s.subspec 'Extension' do |ext|
    ext.source_files = "ios/AppAmbitRNNotificationService.swift"
    ext.dependency 'AppAmbitPushNotifications', '~> 1.0.0'
  end
end
