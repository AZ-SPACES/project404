Pod::Spec.new do |s|
  s.name           = 'AzaWatch'
  s.version        = '1.0.0'
  s.summary        = 'Mirrors a read-only wallet snapshot to a paired Apple Watch.'
  s.description    = 'Phone half of the watch link: owns the WCSession, pushes wallet ' \
                     'snapshots as the application context, and answers refresh ' \
                     'requests from the watch.'
  s.author         = 'Aza'
  s.homepage       = 'https://aza.systems'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
